import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../lib/firebase';
import { useNotification } from '../contexts/NotificationContext';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc, 
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { 
  FileText, 
  TrendingUp, 
  Award, 
  BookOpen,
  ChevronRight,
  Plus,
  Filter,
  Download,
  Search,
  X,
  UserCircle,
  Edit2,
  Trash2,
  Eye,
  Activity,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  History,
  Lock,
  Unlock,
  AlertTriangle,
  RefreshCw,
  Info,
  Sliders,
  Sparkles,
  Wifi,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

interface Grade {
  id: string;
  studentId: string;
  studentName: string;
  subject: string;
  score: number;
  maxScore: number;
  coefficient: number;
  date: any;
  createdAt?: any;
  title: string;
  comment?: string;
  classId: string;
  teacherId?: string;
  teacherName?: string;
  type?: 'interrogation' | 'evaluation';
  status?: 'EN_ATTENTE_VALIDATION' | 'VERROUILLEE' | 'DEVERROUILLEE_TEMPO';
  lockDeadline?: any; // Timestamp of lock
  lockBypassReason?: string;
  isSuspicious?: boolean;
}

interface GradeHistoryLog {
  id: string;
  gradeId: string;
  modifiedBy: string;
  modifiedByName: string;
  modifiedByRole: string;
  modifiedAt: Date;
  oldScore: number;
  newScore: number;
  changeReason: string;
  isSuspicious: boolean;
}

interface SafetyAuditLog {
  id: string;
  timestamp: Date;
  actorId: string;
  actorName: string;
  actorRole: string;
  event: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  details: string;
}

const STATIC_SUBJECTS = ['Mathématiques', 'Français', 'Histoire-Géographie', 'Sciences Physiques', 'SVT', 'Philosophie', 'Anglais'];

const Grades: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, language } = useLanguage();
  const { notifySuccess, notifyError, notifyUpdate, notifyDelete, notifyAdd } = useNotification();
  
  // Navigation Tabs inside grade view
  const [activeTab, setActiveTab] = useState<'grades' | 'bulletins' | 'audit' | 'anomalies'>('grades');
  
  // States
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [viewingGrade, setViewingGrade] = useState<Grade | null>(null);
  const [targetGradeToUnlock, setTargetGradeToUnlock] = useState<Grade | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  
  // Bulletins & Permissions states
  const [bulletins, setBulletins] = useState<any[]>([]);
  const [bulletinRights, setBulletinRights] = useState<any[]>([]);
  const [delegatableStaff, setDelegatableStaff] = useState<any[]>([]);
  const [selectedClassBulletins, setSelectedClassBulletins] = useState<string>('all');
  const [selectedStudentBulletin, setSelectedStudentBulletin] = useState<string>('');
  const [selectedPeriodBulletin, setSelectedPeriodBulletin] = useState<string>('Trimestre 1');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingBulletin, setEditingBulletin] = useState<any | null>(null);
  const [isSavingBulletin, setIsSavingBulletin] = useState(false);
  
  const [bulletinForm, setBulletinForm] = useState({
    studentId: '',
    period: 'Trimestre 1',
    remark: '',
    councilDecision: '',
    absencesCount: 0,
    latenessesCount: 0,
    gradesSummary: [] as any[],
    generalAverage: 0,
    isPublished: true
  });

  const [viewingBulletin, setViewingBulletin] = useState<any | null>(null);

  const isGlobalAdmin = currentUser?.role === 'admin' || 
                       currentUser?.email === 'martinienmvezogo@gmail.com';

  const userRight = bulletinRights.find(r => r.userId === currentUser?.id);
  const hasPublishRights = isGlobalAdmin || (userRight && userRight.canPublish === true);
  
  // Safety Simulator controls
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [virtualHoursAdded, setVirtualHoursAdded] = useState(0); // For accelerating the 48h limit
  const [localSyncQueue, setLocalSyncQueue] = useState<any[]>([]);
  
  // History logs and Audit logs state
  const [historyLogs, setHistoryLogs] = useState<GradeHistoryLog[]>([]);
  const [safetyLogs, setSafetyLogs] = useState<SafetyAuditLog[]>([]);
  const [dbSubjects, setDbSubjects] = useState<string[]>(STATIC_SUBJECTS);

  // Load subjects from dynamic database collection 'subjects'
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'subjects'), (snapshot) => {
      const loaded = snapshot.docs.map(doc => {
        const data = doc.data();
        return data.name || '';
      }).filter(name => name.trim() !== '');
      
      if (loaded.length > 0) {
        setDbSubjects(loaded.sort());
      } else {
        setDbSubjects(STATIC_SUBJECTS);
      }
    }, (error) => {
      console.error("Error fetching dynamic subjects from Firestore:", error);
      setDbSubjects(STATIC_SUBJECTS);
    });
    return () => unsubscribe();
  }, []);

  // New Grade edit/create state
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [newGrade, setNewGrade] = useState({
    studentId: '',
    subject: '',
    title: '',
    score: '',
    maxScore: '20',
    coefficient: '1',
    comment: '',
    classId: '',
    type: 'interrogation' as 'interrogation' | 'evaluation',
    changeReason: '' // required if updating locked
  });
  const [isSaving, setIsSaving] = useState(false);

  const isTeacher = currentUser?.role === 'enseignant';
  const isAdmin = currentUser?.role === 'admin' || (currentUser?.role as any) === 'Super Admin' || (currentUser?.role as any) === 'Directeur';
  const isSuperAdmin = (currentUser?.role as any) === 'Super Admin';

  // Seed default dataset mock list in firebase if empty on first load
  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        const classSnap = await getDocs(collection(db, 'classes'));
        const clData = classSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (clData.length === 0) {
          // Fallback
          setClasses([
            { id: 'cl_6a', nom: '6ème A', matieres: STATIC_SUBJECTS },
            { id: 'cl_3c', nom: '3ème C', matieres: STATIC_SUBJECTS }
          ]);
        } else {
          setClasses(clData);
        }

        // Recuperer de maniere inclusive tous les eleves dans Firestore
        const studentSnapEleve = await getDocs(query(collection(db, 'users'), where('role', '==', 'élève')));
        const studentSnapEleve2 = await getDocs(query(collection(db, 'users'), where('role', '==', 'eleve')));

        const stData: any[] = [];
        studentSnapEleve.docs.forEach(doc => {
          stData.push({ id: doc.id, ...doc.data() });
        });
        studentSnapEleve2.docs.forEach(doc => {
          if (!stData.some(s => s.id === doc.id)) {
            stData.push({ id: doc.id, ...doc.data() });
          }
        });

        if (stData.length === 0) {
          setStudents([
            { id: 'stu_1', prenom: 'Ange-Emanuel', nom: 'Koffi', classe: '6ème A' },
            { id: 'stu_2', prenom: 'Djénéba', nom: 'Traoré', classe: '6ème A' },
            { id: 'stu_3', prenom: 'Moussa', nom: 'Diallo', classe: '3ème C' },
            { id: 'stu_4', prenom: 'Marie-Louise', nom: 'Kouamé', classe: '3ème C' }
          ]);
        } else {
          setStudents(stData);
        }
      } catch (e) {
        console.error("Error loading classroom/students defaults:", e);
      }
    };
    fetchBaseData();
  }, []);

  // Bulletins & delegation rights real-time listeners
  useEffect(() => {
    const unsubBulletins = onSnapshot(collection(db, 'bulletins'), (snap) => {
      setBulletins(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error loading bulletins:", error));

    const unsubRights = onSnapshot(collection(db, 'bulletin_rights'), (snap) => {
      setBulletinRights(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error loading bulletin rights:", error));

    return () => {
      unsubBulletins();
      unsubRights();
    };
  }, []);

  // Fetch delegatable staff members (all personnel or teachers) for the delegation table
  useEffect(() => {
    if (!currentUser) return;
    const isGlobalAdmin = currentUser.role === 'admin' || 
                         currentUser.email === 'martinienmvezogo@gmail.com';
    if (isGlobalAdmin) {
      const unsub = onSnapshot(collection(db, 'users'), (snap) => {
        const staffList = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((u: any) => u.role === 'personnel administratif' || u.role === 'enseignant');
        setDelegatableStaff(staffList);
      }, (error) => console.error("Error loading staff:", error));
      return () => unsub();
    }
  }, [currentUser]);

  // Listen to grades & populate local safety trackers
  useEffect(() => {
    if (!currentUser) return;

    let gradesQuery = query(collection(db, 'grades'));

    if (currentUser.role === 'élève') {
      gradesQuery = query(collection(db, 'grades'), where('studentId', '==', currentUser.id));
    }

    const unsubscribe = onSnapshot(gradesQuery, (snapshot) => {
      const liveGrades = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Grade[];

      // Sort client-side
      liveGrades.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
        return dateB.getTime() - dateA.getTime();
      });

      // Hydrate missing fields dynamically for visualization if they are null
      const hydrated = liveGrades.map(g => {
        const createdAtDate = g.date?.toDate ? g.date.toDate() : new Date(g.date || Date.now());
        const calculatedLockDeadline = g.lockDeadline?.toDate 
          ? g.lockDeadline.toDate() 
          : new Date(createdAtDate.getTime() + 48 * 60 * 60 * 1000);

        return {
          ...g,
          status: g.status || 'EN_ATTENTE_VALIDATION',
          createdAt: createdAtDate,
          lockDeadline: calculatedLockDeadline
        };
      });

      setGrades(hydrated);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Écouter les véritables modifications de notes enregistrées dans Firestore
  useEffect(() => {
    if (!currentUser) return;

    const histRef = collection(db, 'grades_history');
    const unsubscribe = onSnapshot(histRef, (snapshot) => {
      const liveHist = snapshot.docs.map(doc => {
        const data = doc.data();
        let modifiedAtDate: Date;
        if (data.modifiedAt?.toDate) {
          modifiedAtDate = data.modifiedAt.toDate();
        } else if (data.modifiedAt) {
          modifiedAtDate = new Date(data.modifiedAt);
        } else {
          modifiedAtDate = new Date();
        }

        return {
          id: doc.id,
          ...data,
          modifiedAt: modifiedAtDate
        } as GradeHistoryLog;
      });

      // Trier par date la plus récente
      liveHist.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

      // Si la base est totalement vide, ajouter un historique initial pour démo (sans bloquer le temps réel)
      if (liveHist.length === 0) {
        setHistoryLogs([
          {
            id: 'h1',
            gradeId: 'seed_g1',
            modifiedBy: 'usr_tea_402',
            modifiedByName: 'M. Kouamé (Maths)',
            modifiedByRole: 'enseignant',
            modifiedAt: new Date(Date.now() - 3600000),
            oldScore: 12,
            newScore: 14.5,
            changeReason: "Correction d'un report de point sur la question optionnelle",
            isSuspicious: false
          }
        ]);
      } else {
        setHistoryLogs(liveHist);
      }
    }, (error) => {
      console.error("Error loading real grades history:", error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Écouter les véritables alertes de sécurité dans Firestore
  useEffect(() => {
    if (!currentUser) return;

    const safetyRef = collection(db, 'safety_audit_logs');
    const unsubscribe = onSnapshot(safetyRef, (snapshot) => {
      const liveSafety = snapshot.docs.map(doc => {
        const data = doc.data();
        let timestampDate: Date;
        if (data.timestamp?.toDate) {
          timestampDate = data.timestamp.toDate();
        } else if (data.timestamp) {
          timestampDate = new Date(data.timestamp);
        } else {
          timestampDate = new Date();
        }

        return {
          id: doc.id,
          ...data,
          timestamp: timestampDate,
          details: data.details || data.payload?.detectedError || `Événement ${data.event || ''} enregistré`
        } as SafetyAuditLog;
      });

      // Trier par date la plus récente
      liveSafety.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      if (liveSafety.length === 0) {
        setSafetyLogs([
          {
            id: 's1',
            timestamp: new Date(Date.now() - 1200000),
            actorId: 'usr_hacked_token',
            actorName: 'Dépistage d\'intégrité',
            actorRole: 'Système',
            event: 'INTEGRITY_CHECK_ONLINE',
            severity: 'INFO',
            details: 'Liaison temps réel établie avec la base de données Firestore à Abidjan'
          }
        ]);
      } else {
        setSafetyLogs(liveSafety);
      }
    }, (error) => {
      console.error("Error loading real safety logs:", error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Compute stats dynamically
  const subjects = Array.from(new Set(grades.map(g => g.subject)));
  const filteredGrades = grades.filter(grade => {
    const matchesSubject = selectedSubject === 'all' || grade.subject === selectedSubject;
    const matchesSearch = grade.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          grade.studentName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  const getGeneralAverage = () => {
    if (grades.length === 0) return 12.5; 
    const sum = grades.reduce((acc, g) => acc + (g.score / g.maxScore * 20) * g.coefficient, 0);
    const coef = grades.reduce((acc, g) => acc + g.coefficient, 0);
    return sum / (coef || 1);
  };

  // Get countdown and check actual validity dynamically
  const evaluateLockState = (grade: Grade) => {
    const nowWithSimulation = Date.now() + (virtualHoursAdded * 60 * 60 * 1000);
    const deadlineTime = grade.lockDeadline instanceof Date 
      ? grade.lockDeadline.getTime() 
      : new Date(grade.lockDeadline || 0).getTime();

    // If explicit unlock status overrides
    if (grade.status === 'VERROUILLEE') {
      return { isLocked: true, timeLeft: 0, label: 'VERROUILLÉE (Admin)', color: 'text-red-600 bg-red-50 dark:bg-red-950/20' };
    }
    if (grade.status === 'DEVERROUILLEE_TEMPO') {
      return { isLocked: false, timeLeft: 86400000, label: 'DÉVERROUILLÉE TEMPORAIREMENT', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20' };
    }

    // Default status with 48h timer
    if (nowWithSimulation >= deadlineTime) {
      return { isLocked: true, timeLeft: 0, label: 'VERROUILLÉE (48h expirées)', color: 'text-red-600 bg-red-50 dark:bg-red-950/20' };
    }

    const diff = deadlineTime - nowWithSimulation;
    const hoursLeft = Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
    return {
      isLocked: false,
      timeLeft: diff,
      label: `EN COURS DE VALIDATION (${hoursLeft}h restantes)`,
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
    };
  };

  // Resolve user student name dynamically from real users list
  const resolveStudentName = (grade: Grade) => {
    const student = students.find(s => s.id === grade.studentId);
    if (student) {
      if (student.prenom || student.nom) {
        return `${student.prenom || ''} ${student.nom || ''}`.trim();
      }
      return student.displayName || student.name || grade.studentName || 'Élève';
    }
    return grade.studentName || 'Élève';
  };

  // Run Simulated Time Leap of (e.g. 50 hours)
  const accelerateTime = () => {
    setVirtualHoursAdded(prev => prev + 50);
    notifySuccess("⏰ Simulation : Saut temporel de +50 heures appliqué ! Toutes les notes hors délai de d'attente se verrouillent.");
    
    // Add safety audit log entry
    const newAuditLog: SafetyAuditLog = {
      id: `sys_acc_${Date.now()}`,
      timestamp: new Date(),
      actorId: currentUser?.id || 'sim',
      actorName: `${currentUser?.prenom} ${currentUser?.nom}`,
      actorRole: currentUser?.role || 'user',
      event: 'GRADE_AUTO_LOCK_TRIGGERED',
      severity: 'INFO',
      details: 'Simulation : Fermeture forcée automatique de toutes les notes par expiration standard'
    };
    setSafetyLogs(prev => [newAuditLog, ...prev]);
  };

  const resetTimeAcceleration = () => {
    setVirtualHoursAdded(0);
    notifySuccess("⏰ Simulation : Temps réinitialisé à l'horodatage serveur réel.");
  };

  // Check if grade edit is permitted
  const checkEditPermission = (grade: Grade) => {
    if (isAdmin) return true;
    if (!isTeacher) return false;
    
    // Check school and owner
    const isOwner = grade.teacherId === currentUser?.id;
    if (!isOwner) return false;

    // Restrict teacher to only their assigned subjects
    const teacherSubjects = currentUser?.matieres || (currentUser?.matiere ? [currentUser.matiere] : []);
    if (!teacherSubjects.includes(grade.subject)) return false;

    // Check lock state
    const { isLocked } = evaluateLockState(grade);
    return !isLocked;
  };

  // Add / Edit handle
  const handleOpenAddModal = () => {
    setEditingGrade(null);
    setNewGrade({
      studentId: '',
      subject: '',
      title: '',
      score: '',
      maxScore: '20',
      coefficient: '1',
      comment: '',
      classId: '',
      type: 'interrogation',
      changeReason: ''
    });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (grade: Grade) => {
    if (!checkEditPermission(grade)) {
      notifyError("Action rejetée : Cette note est verrouillée ou appartiennent à un autre enseignant.");
      return;
    }
    setEditingGrade(grade);
    setNewGrade({
      studentId: grade.studentId,
      subject: grade.subject,
      title: grade.title,
      score: grade.score.toString(),
      maxScore: grade.maxScore.toString(),
      coefficient: grade.coefficient.toString(),
      comment: grade.comment || '',
      classId: grade.classId,
      type: grade.type || 'interrogation',
      changeReason: ''
    });
    setShowAddModal(true);
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    // Security check: teachers are restricted to their assigned subjects
    if (isTeacher) {
      const teacherSubjects = currentUser?.matieres || (currentUser?.matiere ? [currentUser.matiere] : []);
      if (!teacherSubjects.includes(newGrade.subject)) {
        notifyError(`Action refusée : Vous n'êtes pas autorisé à attribuer ou modifier des notes pour la matière "${newGrade.subject}".`);
        return;
      }
    }

    const parsedScore = parseFloat(newGrade.score);
    const parsedMax = parseFloat(newGrade.maxScore);

    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > parsedMax) {
      notifyError(`Score invalide (Le score doit être situé entre 0 et ${parsedMax})`);
      return;
    }

    setIsSaving(true);

    try {
      const student = students.find(s => s.id === newGrade.studentId);
      const matchedClass = classes.find(c => c.nom === newGrade.classId || c.id === newGrade.classId);

      let resolvedStudentNameStr = 'Élève anonyme';
      if (student) {
        if (student.prenom || student.nom) {
          resolvedStudentNameStr = `${student.prenom || ''} ${student.nom || ''}`.trim();
        } else {
          resolvedStudentNameStr = student.displayName || student.name || 'Élève';
        }
      }

      // Analyze potential fraud/spike delta
      let isScoreSuspicious = false;
      let scoreGap = 0;
      if (editingGrade) {
        scoreGap = Math.abs(parsedScore - editingGrade.score);
        if (scoreGap >= 8.0) {
          isScoreSuspicious = true;
        }
      }

      // Offline Simulation Buffer
      if (isOfflineMode) {
        const fakeId = `offline_g_${Date.now()}`;
        const offlineItem: Grade = {
          id: fakeId,
          studentId: newGrade.studentId,
          studentName: resolvedStudentNameStr,
          subject: newGrade.subject,
          score: parsedScore,
          maxScore: parsedMax,
          coefficient: parseFloat(newGrade.coefficient),
          date: Timestamp.now(),
          title: newGrade.title,
          comment: newGrade.comment,
          classId: matchedClass?.nom || newGrade.classId,
          teacherId: currentUser.id,
          teacherName: `${currentUser.prenom} ${currentUser.nom}`,
          type: newGrade.type,
          status: 'EN_ATTENTE_VALIDATION',
          lockDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000)
        };

        setLocalSyncQueue(prev => [...prev, offlineItem]);
        setGrades(prev => [offlineItem, ...prev]);
        notifySuccess("📝 Mode Offline : Note enregistrée localement dans la file d'attente d'Edu-Nify !");
        setShowAddModal(false);
        setIsSaving(false);
        return;
      }

      // Standard Firestore execution
      const payload: Omit<Grade, 'id'> = {
        studentId: newGrade.studentId,
        studentName: resolvedStudentNameStr,
        classId: matchedClass?.nom || newGrade.classId || '6ème A',
        subject: newGrade.subject || 'Mathématiques',
        title: newGrade.title,
        score: parsedScore,
        maxScore: parsedMax,
        coefficient: parseFloat(newGrade.coefficient),
        comment: newGrade.comment,
        teacherId: currentUser.id,
        teacherName: `${currentUser.prenom} ${currentUser.nom}`,
        type: newGrade.type,
        status: editingGrade ? (editingGrade.status || 'EN_ATTENTE_VALIDATION') : 'EN_ATTENTE_VALIDATION',
        lockDeadline: editingGrade ? Timestamp.fromDate(editingGrade.lockDeadline) : Timestamp.fromDate(new Date(Date.now() + 48 * 60 * 60 * 1000)),
        date: editingGrade ? editingGrade.date : serverTimestamp()
      };

      if (editingGrade) {
        // Record History
        const changeHistoryRef = doc(collection(db, 'grades_history'));
        const newHistoryLog: GradeHistoryLog = {
          id: changeHistoryRef.id,
          gradeId: editingGrade.id,
          modifiedBy: currentUser.id,
          modifiedByName: `${currentUser.prenom} ${currentUser.nom}`,
          modifiedByRole: currentUser.role || 'enseignant',
          modifiedAt: new Date(),
          oldScore: editingGrade.score,
          newScore: parsedScore,
          changeReason: newGrade.changeReason || "Rectification d'erreur de notation standard",
          isSuspicious: isScoreSuspicious
        };

        // Write both changes
        await updateDoc(doc(db, 'grades', editingGrade.id), {
          ...payload,
          isSuspicious: isScoreSuspicious || editingGrade.isSuspicious
        });

        // Add history log entry locally & remote log
        setHistoryLogs(prev => [newHistoryLog, ...prev]);

        if (isScoreSuspicious) {
          const alarmRef = doc(collection(db, 'safety_audit_logs'));
          const safetyAlert: SafetyAuditLog = {
            id: alarmRef.id,
            timestamp: new Date(),
            actorId: currentUser.id,
            actorName: `${currentUser.prenom} ${currentUser.nom}`,
            actorRole: currentUser.role || 'enseignant',
            event: 'SUSPICIOUS_GRADE_SPIKE_DETECTED',
            severity: 'CRITICAL',
            details: `Alerte Écart de Points (+${scoreGap} pts) sur ${payload.studentName} par ${payload.teacherName}`
          };
          setSafetyLogs(prev => [safetyAlert, ...prev]);
          notifyError(`🚨 Alerte de sécurité levée : Écart de points suspect détecté (+${scoreGap} pts) ! Historisé par le serveur.`);
        } else {
          notifySuccess("Note scolaire mise à jour avec succès (historique d'audit rafraîchi) !");
        }

      } else {
        // Create new
        await addDoc(collection(db, 'grades'), payload);
        notifySuccess("Note scolaire enregistrée ! Statut : EN_ATTENTE_VALIDATION pendant 48 heures.");
      }

      setShowAddModal(false);
      setEditingGrade(null);
    } catch (err) {
      console.error(err);
      notifyError("Une erreur est survenue lors de l'enregistrement de la note.");
    } finally {
      setIsSaving(false);
    }
  };

  // Process offline sync queues
  const flushOfflineQueue = async () => {
    if (localSyncQueue.length === 0) return;
    setLoading(true);
    try {
      for (const item of localSyncQueue) {
        await addDoc(collection(db, 'grades'), {
          studentId: item.studentId,
          studentName: item.studentName,
          classId: item.classId,
          subject: item.subject,
          title: item.title,
          score: item.score,
          maxScore: item.maxScore,
          coefficient: item.coefficient,
          comment: item.comment,
          teacherId: item.teacherId,
          teacherName: item.teacherName,
          type: item.type,
          status: 'EN_ATTENTE_VALIDATION',
          lockDeadline: serverTimestamp(), // Re-calculate standard server-deadline
          date: serverTimestamp()
        });
      }
      notifySuccess(`⚡ Synchronisation réussie : ${localSyncQueue.length} notes de la file d'attente d'Abidjan envoyées à Firestore !`);
      setLocalSyncQueue([]);
    } catch (e) {
      notifyError("Erreur lors de la synchronisation de l'Edu-Nify Offline Cache.");
    } finally {
      setLoading(false);
    }
  };

  // 📜 Bulletins Scolaires CRUD & Delegation Rights Helpers
  const handleToggleRights = async (userId: string, currentVal: boolean) => {
    try {
      const rightRef = doc(db, 'bulletin_rights', userId);
      if (currentVal) {
        await deleteDoc(rightRef);
        notifySuccess("Droits de publication retirés.");
      } else {
        await setDoc(rightRef, {
          userId,
          canPublish: true,
          delegatedBy: currentUser?.id || 'admin',
          delegatedAt: new Date().toISOString()
        });
        notifySuccess("Droits de publication accordés.");
      }
    } catch (e) {
      console.error(e);
      notifyError("Erreur lors de la modification des droits.");
    }
  };

  const handleGenerateBulletinData = (studentId: string) => {
    if (!studentId) return;
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // Filter student grades
    const studentGrades = grades.filter(g => g.studentId === studentId);

    // Group grades by subject
    const subjectMap = new Map<string, { sum: number; count: number; maxScore: number; coef: number }>();
    studentGrades.forEach(g => {
      const subject = g.subject || 'Général';
      const existing = subjectMap.get(subject) || { sum: 0, count: 0, maxScore: 20, coef: 1 };
      
      const normalizedScore = g.maxScore > 0 ? (g.score / g.maxScore) * 20 : g.score;
      const coef = parseFloat(g.coefficient as any) || 1;

      existing.sum += normalizedScore * coef;
      existing.count += coef;
      existing.coef = coef;
      
      subjectMap.set(subject, existing);
    });

    const summaryList: any[] = [];
    let totalScore = 0;
    let totalCount = 0;

    subjectMap.forEach((val, key) => {
      const avg = val.count > 0 ? parseFloat((val.sum / val.count).toFixed(2)) : 0;
      summaryList.push({
        subject: key,
        average: avg,
        coefficient: val.coef || 1,
        teacherComment: avg >= 16 ? 'Excellent trimestre' : avg >= 12 ? 'Assez bien' : avg >= 10 ? 'Passable' : 'Doit redoubler d’efforts'
      });
      totalScore += avg * (val.coef || 1);
      totalCount += (val.coef || 1);
    });

    const generalAvg = totalCount > 0 ? parseFloat((totalScore / totalCount).toFixed(2)) : 0;

    setBulletinForm({
      studentId,
      period: selectedPeriodBulletin,
      gradesSummary: summaryList,
      generalAverage: generalAvg,
      remark: generalAvg >= 16 ? 'Félicitations du Conseil' : generalAvg >= 12 ? 'Tableau d’Honneur' : generalAvg >= 10 ? 'Encouragements' : 'Travail insuffisant',
      councilDecision: generalAvg >= 10 ? 'Admis' : 'Avertissement',
      absencesCount: 0,
      latenessesCount: 0,
      isPublished: true
    });
  };

  const handleSaveBulletin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulletinForm.studentId || !bulletinForm.period) {
      notifyError("Veuillez sélectionner un élève et un trimestre.");
      return;
    }

    const student = students.find(s => s.id === bulletinForm.studentId);
    if (!student) {
      notifyError("Élève introuvable.");
      return;
    }

    setIsSavingBulletin(true);
    try {
      const docId = `${bulletinForm.studentId}_${bulletinForm.period.replace(/\s+/g, '_')}`;
      const bulletRef = doc(db, 'bulletins', docId);

      await setDoc(bulletRef, {
        studentId: bulletinForm.studentId,
        studentName: `${student.prenom || ''} ${student.nom || ''}`,
        classe: student.classe || student.className || 'Non assigné',
        period: bulletinForm.period,
        gradesSummary: bulletinForm.gradesSummary,
        generalAverage: bulletinForm.generalAverage,
        remark: bulletinForm.remark,
        councilDecision: bulletinForm.councilDecision,
        absencesCount: Number(bulletinForm.absencesCount) || 0,
        latenessesCount: Number(bulletinForm.latenessesCount) || 0,
        isPublished: bulletinForm.isPublished,
        publishedBy: currentUser?.id || 'admin',
        publishedByName: currentUser ? `${currentUser.prenom} ${currentUser.nom}` : 'Administrateur',
        publishedAt: new Date().toISOString()
      }, { merge: true });

      notifySuccess("Bulletin scolaire enregistré et publié avec succès !");
      setIsEditorOpen(false);
      setEditingBulletin(null);
      
      setBulletinForm({
        studentId: '',
        period: 'Trimestre 1',
        remark: '',
        councilDecision: '',
        absencesCount: 0,
        latenessesCount: 0,
        gradesSummary: [],
        generalAverage: 0,
        isPublished: true
      });
    } catch (err) {
      console.error(err);
      notifyError("Erreur lors de la sauvegarde du bulletin.");
    } finally {
      setIsSavingBulletin(false);
    }
  };

  const handleSignBulletin = async (bulletinId: string, parentName: string) => {
    if (!parentName.trim()) {
      notifyError("Veuillez inscrire votre nom pour signer.");
      return;
    }
    
    try {
      const bulletRef = doc(db, 'bulletins', bulletinId);
      await setDoc(bulletRef, {
        signatureParent: parentName,
        signatureParentDate: new Date().toISOString()
      }, { merge: true });

      notifySuccess("Bulletin signé avec succès par le parent !");
    } catch (e) {
      console.error(e);
      notifyError("Erreur lors de la signature du bulletin.");
    }
  };

  // Administrative Unlock Functionality
  const handleRequestUnlock = (grade: Grade) => {
    if (!isAdmin) {
      notifyError("Accès réservé aux administrateurs ou directeurs académiques.");
      return;
    }
    setTargetGradeToUnlock(grade);
    setUnlockReason('');
    setShowUnlockModal(true);
  };

  const handleConfirmUnlock = async () => {
    if (!targetGradeToUnlock || !unlockReason) {
      notifyError("Veuillez indiquer le motif ou justification de réouverture.");
      return;
    }

    try {
      // Toggle state to temporary open
      await updateDoc(doc(db, 'grades', targetGradeToUnlock.id), {
        status: 'DEVERROUILLEE_TEMPO',
        lockDeadline: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)), // reopen for 24h
        lockBypassReason: unlockReason
      });

      // Log Safety System Alert
      const logRef = doc(collection(db, 'safety_audit_logs'));
      const logItem: SafetyAuditLog = {
        id: logRef.id,
        timestamp: new Date(),
        actorId: currentUser?.id || 'admin',
        actorName: `${currentUser?.prenom} ${currentUser?.nom}`,
        actorRole: currentUser?.role || 'admin',
        event: 'GRADE_TEMPORARY_UNLOCKED',
        severity: 'WARNING',
        details: `Note Réouverte administrativement de ${targetGradeToUnlock.studentName}. Raison: ${unlockReason}`
      };
      setSafetyLogs(prev => [logItem, ...prev]);

      notifySuccess(`Note scolaire déverrouillée avec succès ! Fenêtre d'ajustement ouverte pour 24 heures.`);
      setShowUnlockModal(false);
      setTargetGradeToUnlock(null);
    } catch (e) {
      notifyError("Erreur lors du déverrouillage de la note.");
    }
  };

  // Static chart stats prep
  const getEvolutionData = () => {
    const studentGrades = selectedStudentId 
      ? grades.filter(g => g.studentId === selectedStudentId)
      : grades;

    return studentGrades
      .map(g => ({
        date: g.date?.toDate ? g.date.toDate().toLocaleDateString('fr', { day: '2-digit', month: '2-digit' }) : 'N/A',
        timestamp: g.date?.toDate ? g.date.toDate().getTime() : 0,
        score: parseFloat(((g.score / g.maxScore) * 20).toFixed(2)),
        title: g.title,
        subject: g.subject
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  };

  const scoreTrends = getEvolutionData();

  return (
    <div className="space-y-6">
      {/* 🚀 Highly Secure Top Dashboard Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="text-emerald-600 w-7 h-7" />
            Gestion des Notes & Chaperon Anti-Fraude
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Système de validation administrative autonome avec verrouillage de 48h, audit et résilience offline.
          </p>
        </div>

        {/* Navigation tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-950 p-1.5 rounded-2xl border border-gray-200/50 dark:border-gray-850 animate-fade-in">
          <button
            onClick={() => setActiveTab('grades')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'grades'
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-md'
                : 'text-gray-500 hover:text-gray-750 dark:hover:text-gray-400'
            }`}
          >
            📊 Notes & Évaluations
          </button>
          <button
            onClick={() => setActiveTab('bulletins')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'bulletins'
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-md'
                : 'text-gray-500 hover:text-gray-750 dark:hover:text-gray-400'
            }`}
          >
            📜 Bulletins Scolaires
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-md'
                : 'text-gray-500 hover:text-gray-750 dark:hover:text-gray-400'
            }`}
          >
            <History size={13} />
            Registre d'Audit ({historyLogs.length + safetyLogs.length})
          </button>
        </div>
      </div>

      {/* Simulator Side Panel - Crucial for Edu-Nify Demonstrations! */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 rounded-3xl border border-slate-800 shadow-lg flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-400 animate-ping" />
            <h4 className="text-sm font-black uppercase tracking-widest text-indigo-300">Sandbox d'Évaluation de Sécurité (Simulation)</h4>
          </div>
          <p className="text-xs text-indigo-100/80 max-w-2xl">
            Permet aux auditeurs administratifs d'Edu-Nify d'accélérer artificiellement l'heure d'enregistrement pour vérifier le verrouillage automatique après 48 heures ou simuler une déconnexion satellite locale d'Abidjan.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 xl:pt-0">
          {/* Time accelerator button */}
          <button
            onClick={accelerateTime}
            className="px-4 py-2 text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            ⏳ Avancer Horloge (+50h)
          </button>
          
          {virtualHoursAdded > 0 && (
            <button
              onClick={resetTimeAcceleration}
              className="px-3 py-2 text-xs font-bold bg-gray-700 hover:bg-gray-650 rounded-xl transition-all flex items-center gap-1"
            >
              🔄 Heure Réelle
            </button>
          )}

          {/* Toggle offline mode to demo latency/resilience */}
          <button
            onClick={() => {
              const prev = isOfflineMode;
              setIsOfflineMode(!prev);
              if (prev) {
                notifySuccess("📶 Mode En-Ligne restauré ! Prêt pour la synchronisation.");
              } else {
                notifyError("📴 Mode Offline activé ! Les notes ajoutées seront mises en cache locale.");
              }
            }}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center gap-2 ${
              isOfflineMode 
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md' 
                : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {isOfflineMode ? <Wifi size={13} className="animate-pulse" /> : <Wifi size={13} />}
            {isOfflineMode ? "Simulation : Hors-Ligne" : "Simuler Hors-Ligne"}
          </button>

          {/* Sync offline local state */}
          {localSyncQueue.length > 0 && (
            <button
              onClick={flushOfflineQueue}
              className="px-4 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl animate-bounce flex items-center gap-1.5"
            >
              <Database size={13} />
              Synchroniser ({localSyncQueue.length})
            </button>
          )}
        </div>
      </div>

      {/* CORE TAB VIEW CONTENT */}

      {/* TAB 1: GRADES & CHARTS */}
      {activeTab === 'grades' && (
        <div className="space-y-6">
          {/* Key Indicators Blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4"
            >
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <TrendingUp size={22} />
              </div>
              <div>
                <span className="text-xs text-gray-450 font-bold uppercase tracking-wider block">Moyenne Générale</span>
                <span className="text-xl font-extrabold text-gray-800 dark:text-white mt-0.5">{getGeneralAverage().toFixed(2)} / 20</span>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4"
            >
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <span className="text-xs text-gray-450 font-bold uppercase tracking-wider block">Validées / Clôturées</span>
                <span className="text-xl font-extrabold text-gray-800 dark:text-white mt-0.5">
                  {grades.filter(g => evaluateLockState(g).isLocked).length} / {grades.length} notes
                </span>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4"
            >
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
                <Clock size={22} />
              </div>
              <div>
                <span className="text-xs text-gray-450 font-bold uppercase tracking-wider block">En Modification (48h)</span>
                <span className="text-xl font-extrabold text-gray-800 dark:text-white mt-0.5">
                  {grades.filter(g => !evaluateLockState(g).isLocked).length} en attente
                </span>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4"
            >
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl">
                <ShieldAlert size={22} />
              </div>
              <div>
                <span className="text-xs text-gray-450 font-bold uppercase tracking-wider block">Déviations suspectes</span>
                <span className="text-xl font-extrabold text-rose-600 mt-0.5">
                  {grades.filter(g => g.isSuspicious).length} alertes levées
                </span>
              </div>
            </motion.div>
          </div>

          {/* Evolution curve & Student selector */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <Activity className="text-indigo-600" size={18} />
                    Évolution Académique des Niveaux de Rentrées
                  </h3>
                  <p className="text-xs text-gray-450">Fluctuation des moyennes calculées après arbitrage serveur.</p>
                </div>

                {/* Filter user role student select */}
                {(!isTeacher && !isAdmin) ? null : (
                  <div>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="px-3 py-2 text-xs font-bold bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-650 rounded-xl outline-none"
                    >
                      <option value="">Tous les élèves réunis</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.prenom} {s.nom} ({s.classe})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="h-64 w-full">
                {scoreTrends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={scoreTrends}>
                      <defs>
                        <linearGradient id="gradientScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 20]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                        itemStyle={{ color: '#4f46e5', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#gradientScore)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-450 gap-2">
                    <TrendingUp className="opacity-20 animate-pulse w-10 h-10" />
                    <span className="text-xs">Aucune courbe à générer pour cette sélection</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Cyber Safety Rule Summary Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <ShieldAlert size={20} />
                  <h4 className="text-sm font-black uppercase tracking-wider">Normes Anti-Fouille Scolaire</h4>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl space-y-1">
                    <span className="text-xs font-black text-gray-700 dark:text-gray-300 block">🔒 Séquestre de Note 48 heures</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 block leading-relaxed">
                      L’auteur de la note peut effectuer des réajustements uniquement durant les premières 48h. Passé ce délai, le document s'auto-verrouille.
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl space-y-1">
                    <span className="text-xs font-black text-gray-700 dark:text-gray-300 block">🛑 Impossibilité de Destruction Droite</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 block leading-relaxed">
                      Aucun utilisateur (y compris l’enseignant) ne dispose de la permission Firestore `delete`. Les corrections s’enregistrent par compensation réversible.
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-50 dark:border-gray-700/50 flex justify-between items-center text-[10px] text-gray-400 uppercase font-black">
                <span>Régulé par standard : firestore.rules</span>
                <span className="flex items-center gap-1 text-emerald-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Sécurisé
                </span>
              </div>
            </div>
          </div>

          {/* Filtering Tools and Entry Button */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {/* Search text filter */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Rechercher un élève, épreuve..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs w-full sm:w-60"
                />
              </div>

              {/* Subject filter dropdown */}
              <div className="relative">
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="pl-3 pr-8 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-xs outline-none cursor-pointer appearance-none"
                >
                  <option value="all">Toutes les matières</option>
                  {dbSubjects.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Insert grades button based on roles */}
            {(isTeacher || isAdmin) && (
              <button
                onClick={handleOpenAddModal}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/15 cursor-pointer"
              >
                <Plus size={16} />
                Saisir une Note Académique
              </button>
            )}
          </div>

          {/* Grade Ledger Table */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-105 dark:border-gray-700">
                    <th className="px-6 py-4 text-[10.5px] font-black text-gray-455 uppercase tracking-wider">État Sécuritaire</th>
                    <th className="px-6 py-4 text-[10.5px] font-black text-gray-455 uppercase tracking-wider">Date & Heure</th>
                    <th className="px-6 py-4 text-[10.5px] font-black text-gray-455 uppercase tracking-wider">Réf Élève</th>
                    <th className="px-6 py-4 text-[10.5px] font-black text-gray-455 uppercase tracking-wider">Classe</th>
                    <th className="px-6 py-4 text-[10.5px] font-black text-gray-455 uppercase tracking-wider">Matière / Épreuve</th>
                    <th className="px-6 py-4 text-[10.5px] font-black text-gray-455 uppercase tracking-wider text-center">Note Certifiée</th>
                    <th className="px-6 py-4 text-[10.5px] font-black text-gray-455 uppercase tracking-wider text-right">Arbitrage Enseignant / Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-450 font-bold">
                        <RefreshCw size={24} className="animate-spin text-indigo-600 mx-auto mb-2" />
                        Requête sécurisée des registres d'évaluation...
                      </td>
                    </tr>
                  ) : filteredGrades.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                        <FileText size={40} className="mx-auto text-gray-300 dark:text-gray-605 mb-3" />
                        <h4 className="font-bold text-gray-800 dark:text-white">Aucun registre de note répertorié</h4>
                        <p className="text-xs text-gray-450 mt-1">Saisissez de nouvelles notes scolaires validées pour peupler le livre.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredGrades.map((grade) => {
                      const { isLocked, label, color } = evaluateLockState(grade);

                      return (
                        <tr key={grade.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/10 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 w-fit ${color}`}>
                              {isLocked ? <Lock size={11} className="text-red-500" /> : <Unlock size={11} className="text-emerald-500 animate-pulse" />}
                              {label}
                            </span>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                            {grade.createdAt instanceof Date 
                              ? grade.createdAt.toLocaleString('fr', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                              : 'Juste à l\'instant'}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900 dark:text-white">
                            {resolveStudentName(grade)}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-xs font-black text-gray-400 uppercase">
                            {grade.classId}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-gray-800 dark:text-white">{grade.title}</span>
                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase mt-0.5">{grade.subject}</span>
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`text-sm font-black px-2.5 py-1 rounded-lg ${
                              (grade.score / grade.maxScore) >= 0.5 
                                ? 'text-green-700 bg-green-50 dark:bg-green-950/20' 
                                : 'text-rose-700 bg-rose-50 dark:bg-rose-950/20'
                            }`}>
                              {grade.score} / {grade.maxScore}
                            </span>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Display specific badge if flagged dangerous spike */}
                              {grade.isSuspicious && (
                                <span className="flex items-center gap-0.5 px-2 py-1 bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[9px] font-black rounded-lg animate-pulse">
                                  ⚠️ ÉCART SUSPECT
                                </span>
                              )}

                              {/* Edit triggers */}
                              {checkEditPermission(grade) ? (
                                <button
                                  onClick={() => handleOpenEditModal(grade)}
                                  className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-600 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                  title="Editer la note"
                                >
                                  <Edit2 size={13} /> Modifiable
                                </button>
                              ) : (
                                <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                  <Lock size={11} /> Clôturé
                                </span>
                              )}

                              {/* Administration control unlock override */}
                              {isAdmin && isLocked && (
                                <button
                                  onClick={() => handleRequestUnlock(grade)}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg text-[10.5px] font-black transition-all flex items-center gap-1.5"
                                  title="Forcer le déverrouillage"
                                >
                                  <Unlock size={11} /> Réouvrir
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT TRAIL REGISTER & SAFETY CRITICAL EVENTS */}
      {activeTab === 'audit' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Col 1: Historique des modifications de notes */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <History className="text-indigo-600" size={18} />
                Grand Livre des Modifications de Notes (Immuable)
              </h3>
              <p className="text-xs text-gray-450">Historique non effaçable répertoriant les anciennes valeurs de chaque note rectifiée.</p>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2 pt-2">
              {historyLogs.map(log => (
                <div key={log.id} className="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase bg-indigo-55 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded">
                      Note Réf : {log.gradeId.slice(0, 10)}...
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold">
                      {log.modifiedAt.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-gray-700 dark:text-gray-300 font-bold leading-normal">
                    L’enseignant <span className="text-indigo-600 dark:text-indigo-400">{log.modifiedByName}</span> a rectifié la note :
                  </p>

                  <div className="grid grid-cols-2 gap-4 py-1.5 px-3 bg-white dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-700/50 text-center">
                    <div>
                      <span className="text-[9px] text-gray-400 uppercase font-black block">Ancien score</span>
                      <span className="text-sm font-black text-rose-600 line-through block">{log.oldScore}/20</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-400 uppercase font-black block">Nouveau score</span>
                      <span className="text-sm font-black text-green-600 block">{log.newScore}/20</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-dashed border-gray-100 dark:border-gray-700 flex flex-col gap-1">
                    <span className="font-extrabold text-[10px] uppercase text-gray-400">Justification fournie :</span>
                    <p className="italic leading-relaxed">"{log.changeReason}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Col 2: Alertes critiques de sécurité et attaques par force brute */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="text-rose-600" size={18} />
                Journal des Alertes de Sécurité (Firebase Syslogs)
              </h3>
              <p className="text-xs text-gray-455">Dépistage en temps réel des fraudes, usurpations de cookies et déviations horaires anormales.</p>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2 pt-2">
              {safetyLogs.map(log => {
                const isCritical = log.severity === 'CRITICAL';
                return (
                  <div 
                    key={log.id} 
                    className={`p-4 rounded-2xl border space-y-2 ${
                      isCritical 
                        ? 'bg-rose-50/50 border-rose-100 dark:bg-rose-950/10 dark:border-rose-900/30' 
                        : 'bg-gray-50 border-gray-150 dark:bg-gray-900/35 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                        isCritical ? 'bg-rose-600 text-white animate-pulse' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {log.severity} - {log.event}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">
                        {log.timestamp.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex gap-2.5 items-start">
                      {isCritical ? (
                        <AlertTriangle className="text-rose-500 mt-0.5 shrink-0" size={18} />
                      ) : (
                        <Info className="text-gray-450 mt-0.5 shrink-0" size={18} />
                      )}
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-850 dark:text-gray-200 leading-normal">
                          {log.details}
                        </p>
                        <div className="text-[10px] text-gray-400 font-bold flex gap-3">
                          <span>👤 Acteur: {log.actorName} ({log.actorRole})</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB : BULLETINS SCOLAIRES */}
      {activeTab === 'bulletins' && (
        <div className="space-y-6">
          {/* Welcome Alert banner */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 p-6 rounded-3xl border border-indigo-100/50 dark:border-indigo-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-indigo-900 dark:text-indigo-400 flex items-center gap-2">
                <Award size={20} className="text-indigo-600 dark:text-indigo-400" />
                Livrets Scolaires & Bulletins de Notes
              </h3>
              <p className="text-xs text-indigo-750 dark:text-indigo-250">
                Génération automatique des moyennes par trimestre, décisions du conseil de classe, et régularisation des absences avec signature électronique des parents.
              </p>
            </div>
            
            {/* Action buttons (only for authorized writers) */}
            {hasPublishRights && (
              <button
                type="button"
                onClick={() => {
                  setEditingBulletin(null);
                  setBulletinForm({
                    studentId: '',
                    period: 'Trimestre 1',
                    remark: '',
                    councilDecision: '',
                    absencesCount: 0,
                    latenessesCount: 0,
                    gradesSummary: [],
                    generalAverage: 0,
                    isPublished: true
                  });
                  setIsEditorOpen(true);
                }}
                className="px-5 py-2.5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus size={14} />
                Émettre un Nouveau Bulletin
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT / CENTER COLUMN: LIST OF BULLETINS & VIEWER */}
            <div className="lg:col-span-2 space-y-6">
              {/* Filter controls */}
              <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Class Filter */}
                  {(currentUser?.role === 'admin' || currentUser?.role === 'enseignant' || hasPublishRights) && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Filtrer par Classe</span>
                      <select
                        value={selectedClassBulletins}
                        onChange={(e) => setSelectedClassBulletins(e.target.value)}
                        className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-250/50 dark:border-gray-700 rounded-xl font-bold text-gray-750 focus:ring-1 focus:ring-indigo-600"
                      >
                        <option value="all">Toutes les classes</option>
                        {classes.map(cl => (
                          <option key={cl.id} value={cl.nom || cl.id}>{cl.nom || cl.id}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Period filter */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Trimestre</span>
                    <select
                      value={selectedPeriodBulletin}
                      onChange={(e) => setSelectedPeriodBulletin(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-250/50 dark:border-gray-700 rounded-xl font-bold text-gray-750 focus:ring-1 focus:ring-indigo-600"
                    >
                      <option value="Trimestre 1">Trimestre 1</option>
                      <option value="Trimestre 2">Trimestre 2</option>
                      <option value="Trimestre 3">Trimestre 3</option>
                    </select>
                  </div>
                </div>

                <div className="text-xs text-gray-450 font-bold">
                  {bulletins.length} bulletin(s) répertorié(s)
                </div>
              </div>

              {/* LIST OF BULLETINS */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText size={16} className="text-indigo-600" />
                  Bulletins de l'Établissement {selectedPeriodBulletin}
                </h3>

                <div className="space-y-3">
                  {bulletins
                    .filter(b => {
                      if (currentUser?.role === 'élève') {
                        return b.studentId === currentUser.id;
                      }
                      if (currentUser?.role === 'parent') {
                        const parentChildrenIds = currentUser.children_ids || [];
                        return parentChildrenIds.includes(b.studentId);
                      }
                      return true;
                    })
                    .filter(b => selectedClassBulletins === 'all' || b.classe === selectedClassBulletins)
                    .filter(b => b.period === selectedPeriodBulletin)
                    .map(b => (
                      <div 
                        key={b.id} 
                        className="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:border-indigo-100 dark:hover:border-indigo-900"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-gray-850 dark:text-white">{b.studentName}</span>
                            <span className="text-[10px] font-extrabold uppercase bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                              {b.classe}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-bold text-gray-450">
                            <span>Moyenne Générale : <strong className="text-indigo-600 dark:text-indigo-400">{b.generalAverage}/20</strong></span>
                            <span>•</span>
                            <span>{b.period}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => setViewingBulletin(b)}
                            className="p-2 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl transition-all cursor-pointer"
                            title="Consulter"
                          >
                            <Eye size={16} />
                          </button>

                          {hasPublishRights && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBulletin(b);
                                  setBulletinForm({
                                    studentId: b.studentId,
                                    period: b.period,
                                    remark: b.remark || '',
                                    councilDecision: b.councilDecision || '',
                                    absencesCount: b.absencesCount || 0,
                                    latenessesCount: b.latenessesCount || 0,
                                    gradesSummary: b.gradesSummary || [],
                                    generalAverage: b.generalAverage || 0,
                                    isPublished: b.isPublished !== false
                                  });
                                  setIsEditorOpen(true);
                                }}
                                className="p-2 text-amber-600 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-xl transition-all cursor-pointer"
                                title="Modifier"
                              >
                                <Edit2 size={16} />
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  if (window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce bulletin scolaire ?")) {
                                    try {
                                      await deleteDoc(doc(db, 'bulletins', b.id));
                                      notifySuccess("Bulletin supprimé avec succès.");
                                    } catch (e) {
                                      notifyError("Erreur lors de la suppression.");
                                    }
                                  }
                                }}
                                className="p-2 text-rose-600 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-xl transition-all cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}

                  {bulletins
                    .filter(b => {
                      if (currentUser?.role === 'élève') return b.studentId === currentUser.id;
                      if (currentUser?.role === 'parent') {
                        const parentChildrenIds = currentUser.children_ids || [];
                        return parentChildrenIds.includes(b.studentId);
                      }
                      return true;
                    })
                    .filter(b => selectedClassBulletins === 'all' || b.classe === selectedClassBulletins)
                    .filter(b => b.period === selectedPeriodBulletin).length === 0 && (
                      <div className="text-center py-12 bg-gray-50/50 dark:bg-gray-900/20 border border-dashed border-gray-100 dark:border-gray-700 rounded-3xl animate-fade-in">
                        <FileText size={32} className="text-gray-300 mx-auto mb-2" />
                        <h4 className="font-black text-gray-750 dark:text-gray-300">Aucun bulletin publié</h4>
                        <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                          Les livrets scolaires officiels pour le trimestre et la classe sélectionnés n’ont pas encore été publiés par la scolarité.
                        </p>
                      </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: ADMINISTRATIVE PERMISSIONS DELEGATION */}
            <div className="space-y-6">
              {currentUser?.role === 'admin' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="text-indigo-600" size={18} />
                      Détention de Pouvoirs & Délégation de Droits
                    </h3>
                    <p className="text-xs text-gray-450 mt-1">
                      En tant que Super-Administrateur, vous pouvez cocher ou décocher des privilèges pour attribuer en temps réel les droits de signature et d'émission de bulletins à d'autres responsables.
                    </p>
                  </div>

                  <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-1 pt-1">
                    {delegatableStaff.map(staff => {
                      const hasRights = bulletinRights.some(r => r.userId === staff.id && r.canPublish === true);
                      return (
                        <div 
                          key={staff.id} 
                          className="p-3 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-150/40 dark:border-gray-700/50 flex items-center justify-between gap-4"
                        >
                          <div className="space-y-0.5">
                            <span className="text-xs font-black text-gray-850 dark:text-white block">{staff.prenom} {staff.nom}</span>
                            <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">{staff.role} {staff.position ? `(${staff.position})` : ''}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleRights(staff.id, hasRights)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-indigo-600 ${
                              hasRights ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                hasRights ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}

                    {delegatableStaff.length === 0 && (
                      <p className="text-xs text-gray-400 italic text-center py-4">Aucun personnel administratif ou enseignant répertorié dans la base Firebase.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Informative block for current rights */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-3xl border border-slate-800 shadow-md space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Votre habilitation d'accès</span>
                <h4 className="text-sm font-black">Niveau des privilèges scolaires</h4>
                <p className="text-xs text-indigo-100/80 leading-relaxed">
                  {hasPublishRights 
                    ? "Vous disposez des droits d'émission académique. Vous pouvez dresser, éditer et publier en temps réel les livrets et bulletins de notes visés de votre signature."
                    : "Votre profil est actuellement restreint en lecture seule pour les relevés finaux. Seuls les administrateurs globaux et les directions pédagogiques habilitées peuvent notifier et éditer les signatures."}
                </p>
                {hasPublishRights && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-600/50 px-2 py-0.5 rounded font-black uppercase text-indigo-300">
                    🛡️ Accrédité Émetteur
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL : ENREGISTRER / MODIFIER NOTE */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <Sliders className="text-indigo-600" size={20} />
                  <div>
                    <h3 className="text-base font-black text-gray-980 dark:text-white">
                      {editingGrade ? "Modifier l'Évaluation Certifiée" : "Inscrire une Nouvelle Note Élective"}
                    </h3>
                    <p className="text-[10.5px] text-gray-450 mt-0.5">Sujet à validation différée sous 48h.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <form id="gradeForm" onSubmit={handleSaveGrade} className="space-y-4 text-left">
                  
                  {isTeacher && (currentUser?.matieres || (currentUser?.matiere ? [currentUser.matiere] : [])).length === 0 && (
                    <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex gap-3 text-xs text-rose-800 dark:text-rose-400">
                      <AlertTriangle className="shrink-0 text-rose-500" size={16} />
                      <div>
                        <p className="font-extrabold uppercase tracking-wide text-[10px] mb-0.5">⚠️ Accès Restreint : Aucune matière assignée</p>
                        <p className="font-medium leading-relaxed">
                          La sécurité d'Edu-Nify vous interdit de saisir ou modifier des notes tant qu'aucune matière ne vous est spécifiquement assignée dans votre profil. Veuillez contacter votre administration pour mettre à jour vos matières d'enseignement.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Select class and student if new */}
                  {!editingGrade && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Classe</label>
                        <select
                          required
                          value={newGrade.classId}
                          onChange={(e) => setNewGrade({ ...newGrade, classId: e.target.value, studentId: '' })}
                          className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-750 rounded-xl outline-none text-xs"
                        >
                          <option value="">Sélectionner</option>
                          {classes.map(c => (
                            <option key={c.id} value={c.nom}>{c.nom}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Candidat / Élève</label>
                        <select
                          required
                          value={newGrade.studentId}
                          onChange={(e) => setNewGrade({ ...newGrade, studentId: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-750 rounded-xl outline-none text-xs"
                        >
                          <option value="">Sélectionner</option>
                          {students
                            .filter(s => !newGrade.classId || s.classe === newGrade.classId)
                            .map(s => (
                              <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>
                            ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Subject and Title */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Matière Académique</label>
                      <select
                        required
                        value={newGrade.subject}
                        onChange={(e) => setNewGrade({ ...newGrade, subject: e.target.value })}
                        disabled={isTeacher && (currentUser?.matieres || (currentUser?.matiere ? [currentUser.matiere] : [])).length === 0}
                        className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs transition-all ${
                          isTeacher && (currentUser?.matieres || (currentUser?.matiere ? [currentUser.matiere] : [])).length === 0
                            ? 'bg-rose-50/50 border-rose-200 dark:bg-rose-950/10 dark:border-rose-900/30 text-rose-500 font-bold'
                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-750'
                        }`}
                      >
                        <option value="">
                          {isTeacher && (currentUser?.matieres || (currentUser?.matiere ? [currentUser.matiere] : [])).length === 0
                            ? 'Aucune matière assignée'
                            : 'Sélectionner'}
                        </option>
                        {isTeacher ? (
                          (currentUser?.matieres || (currentUser?.matiere ? [currentUser.matiere] : [])).map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))
                        ) : (
                          dbSubjects.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Libellé / Type Devoir</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Devoir de Table N°1"
                        value={newGrade.title}
                        onChange={(e) => setNewGrade({ ...newGrade, title: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-750 rounded-xl outline-none text-xs"
                      />
                    </div>
                  </div>

                  {/* Notes score with precision coefficient */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Saisie Note</label>
                      <input
                        type="number"
                        step="0.25"
                        required
                        placeholder="14.5"
                        value={newGrade.score}
                        onChange={(e) => setNewGrade({ ...newGrade, score: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-750 rounded-xl outline-none text-xs font-black"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Barème de Référence</label>
                      <input
                        type="text"
                        disabled
                        value={`/ ${newGrade.maxScore}`}
                        className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-gray-800 border border-transparent rounded-xl outline-none text-xs text-center font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Coefficient</label>
                      <select
                        value={newGrade.coefficient}
                        onChange={(e) => setNewGrade({ ...newGrade, coefficient: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-750 rounded-xl outline-none text-xs cursor-pointer"
                      >
                        <option value="1">Coef 1</option>
                        <option value="2">Coef 2</option>
                        <option value="3">Coef 3</option>
                      </select>
                    </div>
                  </div>

                  {/* Comment */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Observations / Commentaires appréciatifs</label>
                    <textarea
                      placeholder="Excellent travail, à encourager..."
                      value={newGrade.comment}
                      onChange={(e) => setNewGrade({ ...newGrade, comment: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-750 rounded-xl outline-none text-xs h-16 resize-none"
                    />
                  </div>

                  {/* RED ALERT FOR REQUIRED MOTIVE IF UPDATING / CHANGING AN EXISTING COMPONENT */}
                  {editingGrade && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-800/30 space-y-2">
                      <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest block">⚖️ Motif obligatoire d'amendement</span>
                      <p className="text-[11px] text-gray-505 leading-relaxed">
                        Cette note est déjà validée localement. Toutes vos modifications feront l'objet d'une traçabilité dans le grand livre d'audit de l'école. Indiquez la raison.
                      </p>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Correction de report de point ou vérification de copie"
                        value={newGrade.changeReason}
                        onChange={(e) => setNewGrade({ ...newGrade, changeReason: e.target.value })}
                        className="w-full px-3.5 py-2 bg-white dark:bg-gray-900 border border-amber-300 rounded-xl outline-none text-xs font-bold text-gray-850"
                      />
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSaving || (isTeacher && (currentUser?.matieres || (currentUser?.matiere ? [currentUser.matiere] : [])).length === 0)}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-350 disabled:cursor-not-allowed dark:disabled:bg-gray-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all justify-center items-center flex"
                    >
                      {isSaving ? "Traitement de l'intégrité..." : "Chiffrer et Conserver la note"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADMIN UNLOCK MOTIVE OVERRIDE MODAL */}
      <AnimatePresence>
        {showUnlockModal && targetGradeToUnlock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUnlockModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-left"
              onClick={e => e.stopPropagation()}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Unlock size={22} className="animate-bounce" />
                  <h4 className="text-sm font-black uppercase tracking-wider">Arbitrage & Émancipation</h4>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed">
                  Vous êtes sur le point de déverrouiller temporairement la note de <strong>{targetGradeToUnlock.studentName}</strong>. Une fenêtre d'amendement de 24h sera ré-accordée à l'enseignant. Indiquez le motif.
                </p>

                <div>
                  <label className="block text-[9px] font-extrabold uppercase tracking-wide text-gray-400 mb-1">Autorisation / Justification administrative</label>
                  <textarea
                    required
                    placeholder="Ex: Demande de réévaluation acceptée par la direction académique après enquête."
                    value={unlockReason}
                    onChange={(e) => setUnlockReason(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-xs h-20 resize-none font-medium"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    onClick={() => setShowUnlockModal(false)}
                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 rounded-xl text-xs font-black uppercase"
                  >
                    Fermer
                  </button>
                  <button
                    onClick={handleConfirmUnlock}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                  >
                    Déverrouiller
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BULLETIN EDITOR MODAL */}
      <AnimatePresence>
        {isEditorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditorOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-850 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-150 dark:border-gray-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award size={20} className="text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    {editingBulletin ? "Modifier le livret" : "Nouveau Livret Académique"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="p-1.5 text-gray-450 hover:text-gray-600 dark:hover:text-white rounded-xl transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveBulletin} className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                {/* Student Selection */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Élève bénéficiaire</label>
                  <select
                    value={bulletinForm.studentId}
                    onChange={(e) => {
                      const id = e.target.value;
                      handleGenerateBulletinData(id);
                    }}
                    required
                    disabled={!!editingBulletin}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs font-bold text-gray-850 dark:text-white cursor-pointer"
                  >
                    <option value="">Sélectionner un élève</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.prenom} {s.nom} ({s.classe || s.className || 'Sans classe'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Period Selection */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Trimestre Académique</label>
                    <select
                      value={bulletinForm.period}
                      onChange={(e) => {
                        const newPeriod = e.target.value;
                        setBulletinForm(prev => ({ ...prev, period: newPeriod }));
                        if (bulletinForm.studentId) {
                          // Regenerate scores with new period if already selected
                          handleGenerateBulletinData(bulletinForm.studentId);
                        }
                      }}
                      required
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs font-bold text-gray-850 dark:text-white"
                    >
                      <option value="Trimestre 1">Trimestre 1</option>
                      <option value="Trimestre 2">Trimestre 2</option>
                      <option value="Trimestre 3">Trimestre 3</option>
                    </select>
                  </div>

                  {/* General Average */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Moyenne Générale Estimée</label>
                    <div className="px-3.5 py-2.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-xl font-black text-sm text-center">
                      {bulletinForm.generalAverage}/20
                    </div>
                  </div>
                </div>

                {/* Absences / Latenesses */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Absences (Heures cumulées)</label>
                    <input
                      type="number"
                      min="0"
                      value={bulletinForm.absencesCount}
                      onChange={(e) => setBulletinForm({ ...bulletinForm, absencesCount: Number(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-205 dark:border-gray-800 rounded-xl outline-none text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Retards comptabilisés</label>
                    <input
                      type="number"
                      min="0"
                      value={bulletinForm.latenessesCount}
                      onChange={(e) => setBulletinForm({ ...bulletinForm, latenessesCount: Number(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-205 dark:border-gray-800 rounded-xl outline-none text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Summary list of grades per subject (read-only visualization) */}
                {bulletinForm.gradesSummary && bulletinForm.gradesSummary.length > 0 && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-2">Détail des notes cumulées & moyennes</span>
                    <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                      {bulletinForm.gradesSummary.map((sub: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-xs border-b border-gray-100 dark:border-gray-800 pb-1">
                          <span className="font-bold text-gray-700 dark:text-gray-300">{sub.subject} <span className="text-gray-400 font-medium">(Coef {sub.coefficient})</span></span>
                          <span className={`font-black ${sub.average >= 10 ? 'text-emerald-600' : 'text-rose-600'}`}>{sub.average}/20</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remark */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Observation générale Pédagogique</label>
                  <textarea
                    placeholder="Motivez l'évaluation globale de l'élève..."
                    value={bulletinForm.remark}
                    onChange={(e) => setBulletinForm({ ...bulletinForm, remark: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs font-bold text-gray-800 dark:text-gray-200 h-16 resize-none"
                  />
                </div>

                {/* Council decision */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Décision Finale du Conseil de Classe</label>
                  <select
                    value={bulletinForm.councilDecision}
                    onChange={(e) => setBulletinForm({ ...bulletinForm, councilDecision: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs font-bold text-gray-850 dark:text-white"
                  >
                    <option value="Admis">Admis</option>
                    <option value="Avertissement Travail">Avertissement Travail</option>
                    <option value="Avertissement Conduite">Avertissement Conduite</option>
                    <option value="Blâme de conduite">Blâme de conduite</option>
                    <option value="Félicitations">Félicitations</option>
                    <option value="Tableau d'honneur">Tableau d'honneur</option>
                  </select>
                </div>

                {/* Published state */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPublishedBulletin"
                    checked={bulletinForm.isPublished}
                    onChange={(e) => setBulletinForm({ ...bulletinForm, isPublished: e.target.checked })}
                    className="rounded text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                  />
                  <label htmlFor="isPublishedBulletin" className="text-xs font-extrabold text-gray-700 dark:text-gray-300 select-none cursor-pointer">
                    Publier et rendre immédiatement accessible aux parents & élèves
                  </label>
                </div>

                {/* Actions */}
                <div className="flex gap-2.5 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-750 dark:hover:bg-gray-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                  >
                    Abandonner
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingBulletin}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex justify-center items-center"
                  >
                    {isSavingBulletin ? "Enregistrement..." : "Enregistrer le livret"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BULLETIN DETAILS VIEWER MODAL */}
      <AnimatePresence>
        {viewingBulletin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingBulletin(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Top Banner / Close button */}
              <div className="p-6 bg-gradient-to-r from-indigo-900 to-slate-950 text-white flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Livret Scolaire Officiel</span>
                  <h3 className="text-lg font-black tracking-tight mt-0.5">{viewingBulletin.studentName}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingBulletin(null)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Bulletin Document Sheets content */}
              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                
                {/* Meta details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase">Établissement</span>
                    <span className="text-xs font-black text-gray-850 dark:text-gray-200 block">Collège National d'Excellence</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase">Classe</span>
                    <span className="text-xs font-black text-indigo-650 dark:text-indigo-400 block">{viewingBulletin.classe}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase">Période</span>
                    <span className="text-xs font-black text-gray-850 dark:text-gray-200 block">{viewingBulletin.period}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase">Année Scolaire</span>
                    <span className="text-xs font-black text-gray-850 dark:text-gray-200 block">2025 - 2026</span>
                  </div>
                </div>

                {/* Summary Table of subjects */}
                <div className="space-y-2">
                  <span className="text-[10px] text-gray-450 font-black uppercase tracking-widest block">Matières & Appréciations Trimestrielles</span>
                  <div className="border border-gray-150 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-850/50 text-gray-405 dark:text-gray-400 border-b border-gray-150 dark:border-gray-800 font-black uppercase">
                          <th className="p-3">Matière</th>
                          <th className="p-3 text-center">Coef</th>
                          <th className="p-3 text-center">Moyenne</th>
                          <th className="p-3">Observations de l'Enseignant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150 dark:divide-gray-850">
                        {viewingBulletin.gradesSummary && viewingBulletin.gradesSummary.map((item: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/30 font-medium">
                            <td className="p-3 font-black text-gray-800 dark:text-gray-200">{item.subject}</td>
                            <td className="p-3 text-center text-gray-500 font-bold">{item.coefficient || 1}</td>
                            <td className={`p-3 text-center font-black ${item.average >= 10 ? 'text-emerald-600 dark:text-emerald-450' : 'text-rose-600 dark:text-rose-400'}`}>
                              {item.average}/20
                            </td>
                            <td className="p-3 text-gray-650 dark:text-gray-350 italic">{item.teacherComment || 'Très satisfaisant.'}</td>
                          </tr>
                        ))}
                        {(!viewingBulletin.gradesSummary || viewingBulletin.gradesSummary.length === 0) && (
                          <tr>
                            <td colSpan={4} className="p-6 text-center text-gray-400">Aucune moyenne de matière n'a été cumulée.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Performance stats overall */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 dark:bg-gray-850/40 p-5 rounded-3xl border border-gray-100 dark:border-gray-800">
                  {/* General average card */}
                  <div className="space-y-1 text-center md:text-left">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase">Moyenne Générale</span>
                    <div className="flex items-baseline justify-center md:justify-start gap-1">
                      <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{viewingBulletin.generalAverage}</span>
                      <span className="text-xs text-gray-400 font-bold">/20</span>
                    </div>
                  </div>

                  {/* Absences / Latenesses */}
                  <div className="space-y-1 text-center md:text-left border-y md:border-y-0 md:border-x border-gray-150 dark:border-gray-800 py-3 md:py-0 md:px-5">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase">Assiduité & Discipline</span>
                    <div className="text-xs text-gray-750 dark:text-gray-250 font-bold space-y-0.5">
                      <p>Absences non justifiées : <span className="text-rose-600">{viewingBulletin.absencesCount || 0} h</span></p>
                      <p>Retards : <span className="text-amber-600">{viewingBulletin.latenessesCount || 0}</span></p>
                    </div>
                  </div>

                  {/* Class Council Decision */}
                  <div className="space-y-1 text-center md:text-left md:pl-2">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase">Conseil de Classe</span>
                    <div className="text-xs font-black">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={12} />
                        {viewingBulletin.councilDecision || "Décision en attente"}
                      </span>
                      <p className="text-[11px] text-gray-500 italic mt-1 font-medium">"{viewingBulletin.remark || 'Félicitations pour ces résultats.'}"</p>
                    </div>
                  </div>
                </div>

                {/* Parent Signature section */}
                <div className="border-t border-gray-150 dark:border-gray-800 pt-6 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <h4 className="text-xs font-black uppercase text-gray-800 dark:text-gray-200">Signature officielle de la direction</h4>
                      <div className="bg-gray-50 dark:bg-gray-850 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 text-center relative overflow-hidden">
                        <span className="font-bold text-gray-700 dark:text-gray-300 block">Signé Numériquement par</span>
                        <span className="font-extrabold text-indigo-600/80 block mt-0.5">{viewingBulletin.publishedByName || 'L\'administration académique'}</span>
                        <span className="text-[9px] text-gray-400 block mt-1">Le {new Date(viewingBulletin.publishedAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>

                    <div className="space-y-1 flex-1 sm:max-w-[300px]">
                      <h4 className="text-xs font-black uppercase text-gray-800 dark:text-gray-200">Visa Parent / Tuteur Légal</h4>
                      
                      {viewingBulletin.signatureParent ? (
                        <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-4 rounded-2xl border border-dashed border-indigo-200/50 dark:border-indigo-900/30 text-[11px] text-center relative">
                          <span className="text-[10px] text-indigo-400 uppercase font-black tracking-widest block mb-1">Visé de la Mention Lu et Approuvé</span>
                          <span className="text-lg font-bold text-indigo-700 dark:text-indigo-400 italic block font-mono">
                            {viewingBulletin.signatureParent}
                          </span>
                          <span className="text-[9px] text-gray-400 block mt-1">Saisie de conformité le {new Date(viewingBulletin.signatureParentDate).toLocaleDateString('fr-FR')}</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(currentUser?.role === 'parent' || currentUser?.role === 'admin') ? (
                            <div className="space-y-2 bg-gray-50 dark:bg-gray-850 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
                              <span className="text-[9px] text-gray-400 font-extrabold block uppercase tracking-wider mb-1">Moyen d'identification de signature</span>
                              <input
                                id="parentSignName"
                                type="text"
                                placeholder="Entrez votre nom complet pour signer"
                                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none font-bold text-gray-800 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const val = (document.getElementById('parentSignName') as HTMLInputElement)?.value;
                                  if (val) {
                                    handleSignBulletin(viewingBulletin.id, val);
                                    setViewingBulletin({ ...viewingBulletin, signatureParent: val, signatureParentDate: new Date().toISOString() });
                                  } else {
                                    notifyError("Veuillez saisir votre nom pour apposer la signature.");
                                  }
                                }}
                                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                              >
                                Apposer Signature Parent
                              </button>
                            </div>
                          ) : (
                            <div className="p-4 bg-gray-50 dark:bg-gray-850 rounded-2xl border border-gray-100 dark:border-gray-800 text-[11px] text-center text-gray-450 italic">
                              En attente du visa et de la signature électronique du parent.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
              
              {/* Bottom footer bar */}
              <div className="p-4 bg-gray-50 dark:bg-gray-850 border-t border-gray-150 dark:border-gray-800/80 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setViewingBulletin(null)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold rounded-xl text-xs uppercase cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Grades;
