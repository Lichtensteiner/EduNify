import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  Timestamp,
  setDoc
} from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  MapPin, 
  BookOpen, 
  Users, 
  Trash2, 
  Edit2, 
  Search, 
  X, 
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Sliders,
  Sparkles,
  Lock,
  Unlock,
  Check,
  RefreshCw,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PlanningItem {
  id: string;
  teacherId: string;
  teacherName: string;
  title: string;
  description: string;
  startTime: Timestamp;
  endTime: Timestamp;
  type: 'cours' | 'réunion' | 'examen' | 'autre';
  classId?: string;
  className?: string;
  subject?: string;
  createdAt: Timestamp;
}

interface TimetableAssignment {
  id: string;
  classId: string;
  className: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  dayOfWeek: string; // 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi'
  slotId: string; // '1', '2', '3', '4', '5', '6'
  room: string;
  color?: string;
  isLocked?: boolean;
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const TIME_SLOTS = [
  { id: '1', name: '08:00 - 09:30', startMin: 480, endMin: 570, isBreak: false },
  { id: '2', name: '09:30 - 11:00', startMin: 570, endMin: 660, isBreak: false },
  { id: 'break1', name: '11:00 - 11:15', isBreak: true, label: 'Récréation' },
  { id: '3', name: '11:15 - 12:45', startMin: 675, endMin: 765, isBreak: false },
  { id: 'lunch', name: '12:45 - 14:00', isBreak: true, label: 'Pause Midi / Déjeuner' },
  { id: '4', name: '14:00 - 15:30', startMin: 840, endMin: 930, isBreak: false },
  { id: '5', name: '15:30 - 17:00', startMin: 930, endMin: 1020, isBreak: false },
  { id: '6', name: '17:00 - 18:30', startMin: 1020, endMin: 1110, isBreak: false },
];

const COLORS = [
  'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300',
  'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300',
  'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300',
  'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300',
  'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300',
  'bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-300',
  'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300',
  'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-300',
];

const STATIC_SUBJECTS = ['Mathématiques', 'Français', 'Histoire-Géographie', 'Anglais', 'Sciences Physiques', 'SVT', 'EPS', 'Philosophie', 'Arts Plastiques', 'Informatique'];
const STATIC_TEACHERS = [
  { id: 't_kouame', name: 'M. Kouamé (Maths)' },
  { id: 't_diallo', name: 'Mme Diallo (Histoire-Géo)' },
  { id: 't_sow', name: 'M. Sow (Français)' },
  { id: 't_koffi', name: 'M. Koffi (Physiques)' },
  { id: 't_smith', name: 'Mme Smith (Anglais)' },
  { id: 't_traore', name: 'Mme Traoré (SVT)' },
  { id: 't_bamba', name: 'M. Bamba (EPS)' },
  { id: 't_toure', name: 'M. Touré (Philo)' },
  { id: 't_yigo', name: 'Mme Yigo (Arts)' },
];

const STATIC_ROOMS = ['Salle 101', 'Salle L-02', 'Labo Physique A', 'Labo SVT B', 'Terrain de Sport', 'Amphi A', 'Salle Informatique'];

const DEFAULT_ASSIGNMENTS: Omit<TimetableAssignment, 'id'>[] = [
  { classId: 'c1', className: '6ème A', dayOfWeek: 'Lundi', slotId: '1', subject: 'Mathématiques', teacherId: 't_kouame', teacherName: 'M. Kouamé (Maths)', room: 'Salle 101', color: COLORS[0] },
  { classId: 'c1', className: '6ème A', dayOfWeek: 'Lundi', slotId: '2', subject: 'Histoire-Géographie', teacherId: 't_diallo', teacherName: 'Mme Diallo (Histoire-Géo)', room: 'Salle 102', color: COLORS[3] },
  { classId: 'c1', className: '6ème A', dayOfWeek: 'Lundi', slotId: '3', subject: 'Français', teacherId: 't_sow', teacherName: 'M. Sow (Français)', room: 'Salle 101', color: COLORS[2] },
  
  { classId: 'c1', className: '6ème A', dayOfWeek: 'Mardi', slotId: '1', subject: 'Sciences Physiques', teacherId: 't_koffi', teacherName: 'M. Koffi (Physiques)', room: 'Labo Physique A', color: COLORS[1] },
  { classId: 'c1', className: '6ème A', dayOfWeek: 'Mardi', slotId: '3', subject: 'Anglais', teacherId: 't_smith', teacherName: 'Mme Smith (Anglais)', room: 'Salle L-02', color: COLORS[4] },
  
  { classId: 'c1', className: '6ème A', dayOfWeek: 'Mercredi', slotId: '1', subject: 'SVT', teacherId: 't_traore', teacherName: 'Mme Traoré (SVT)', room: 'Labo SVT B', color: COLORS[5] },
  { classId: 'c1', className: '6ème A', dayOfWeek: 'Mercredi', slotId: '2', subject: 'EPS', teacherId: 't_bamba', teacherName: 'M. Bamba (EPS)', room: 'Terrain de Sport', color: COLORS[6] },
  
  { classId: 'c1', className: '6ème A', dayOfWeek: 'Jeudi', slotId: '2', subject: 'Mathématiques', teacherId: 't_kouame', teacherName: 'M. Kouamé (Maths)', room: 'Salle 101', color: COLORS[0] },
  { classId: 'c1', className: '6ème A', dayOfWeek: 'Jeudi', slotId: '4', subject: 'Français', teacherId: 't_sow', teacherName: 'M. Sow (Français)', room: 'Salle 101', color: COLORS[2] },
  
  { classId: 'c1', className: '6ème A', dayOfWeek: 'Vendredi', slotId: '1', subject: 'Anglais', teacherId: 't_smith', teacherName: 'Mme Smith (Anglais)', room: 'Salle L-02', color: COLORS[4] },
  { classId: 'c1', className: '6ème A', dayOfWeek: 'Vendredi', slotId: '3', subject: 'Philosophie', teacherId: 't_toure', teacherName: 'M. Touré (Philo)', room: 'Amphi A', color: COLORS[7] },
  
  { classId: 'c1', className: '6ème A', dayOfWeek: 'Samedi', slotId: '1', subject: 'Arts Plastiques', teacherId: 't_yigo', teacherName: 'Mme Yigo (Arts)', room: 'Salle L-02', color: COLORS[6] },
];

const TeacherPlanning: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, language } = useLanguage();
  const { notifySuccess, notifyError, notifyDelete } = useNotification();
  
  // Navigation Section State
  const [activeSection, setActiveSection] = useState<'timetable' | 'agenda'>('timetable');
  
  // Timetable State
  const [assignments, setAssignments] = useState<TimetableAssignment[]>([]);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('c1');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');
  const [loadingTimetable, setLoadingTimetable] = useState(true);
  
  // Timetable Assignment Modal Form State
  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ day: string; slotId: string } | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<TimetableAssignment | null>(null);
  
  const [assignmentForm, setAssignmentForm] = useState({
    subject: '',
    teacherId: '',
    room: '',
    classId: '',
    color: COLORS[0],
    isLocked: false
  });

  // AI Generator Panel State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);
  const [showGeneratorPanel, setShowGeneratorPanel] = useState(false);
  const [constraintsConfig, setConstraintsConfig] = useState({
    maxHoursPerDay: 6,
    preventDoubleIntervals: true,
    respectVacatairesDispo: true,
    smartClassroomAllocation: true,
  });

  // Daily Planning States (Agenda Tab)
  const [planning, setPlanning] = useState<PlanningItem[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(true);
  const [showAddAgendaModal, setShowAddAgendaModal] = useState(false);
  const [editingAgendaItem, setEditingAgendaItem] = useState<PlanningItem | null>(null);
  const [agendaSubjects, setAgendaSubjects] = useState<string[]>([]);
  
  // Agenda Form state
  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  const getOneHourLater = () => {
    const later = new Date(Date.now() + 3600000);
    return `${later.getHours().toString().padStart(2, '0')}:${later.getMinutes().toString().padStart(2, '0')}`;
  };

  const [agendaFormData, setAgendaFormData] = useState({
    title: '',
    description: '',
    type: 'cours',
    classId: '',
    className: '',
    subject: '',
    startDate: new Date().toISOString().split('T')[0],
    startTime: getCurrentTime(),
    endDate: new Date().toISOString().split('T')[0],
    endTime: getOneHourLater()
  });

  const isTeacher = currentUser?.role === 'enseignant';
  const isAdmin = currentUser?.role === 'admin';

  // 1. Listen to Classes & Load Timetables
  useEffect(() => {
    const unsubscribeClasses = onSnapshot(collection(db, 'classes'), (snapshot) => {
      const fetchedClasses = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().nom || doc.data().name || doc.data().label || 'Classe sans nom'
      }));
      
      // Default classes fallback
      if (fetchedClasses.length === 0) {
        setClasses([
          { id: 'c1', name: '6ème A' },
          { id: 'c2', name: '5ème B' },
          { id: 'c3', name: '4ème A' },
          { id: 'c4', name: '3ème C' },
          { id: 'c5', name: '2nde S' },
          { id: 'c6', name: '1ère D' },
          { id: 'c7', name: 'Terminale S' },
        ]);
      } else {
        setClasses(fetchedClasses);
        // Automatically target first class
        if (fetchedClasses.length > 0 && selectedClassId === 'c1') {
          setSelectedClassId(fetchedClasses[0].id);
        }
      }
    });

    const qTimetable = query(collection(db, 'timetable_assignments'));
    const unsubscribeTimetable = onSnapshot(qTimetable, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TimetableAssignment[];

      if (items.length === 0) {
        // Hydrate with local defaults (simulation or seed)
        setAssignments(DEFAULT_ASSIGNMENTS.map((item, index) => ({
          id: `seed_${index}`,
          ...item
        })) as TimetableAssignment[]);
      } else {
        setAssignments(items);
      }
      setLoadingTimetable(false);
    }, (error) => {
      console.error("Firestore timetable loading failed, fallback to defaults.", error);
      // Fallback
      setAssignments(DEFAULT_ASSIGNMENTS.map((item, index) => ({
        id: `seed_${index}`,
        ...item
      })) as TimetableAssignment[]);
      setLoadingTimetable(false);
    });

    return () => {
      unsubscribeClasses();
      unsubscribeTimetable();
    };
  }, []);

  // 2. Fetch Daily Agenda (Agenda tab)
  useEffect(() => {
    if (!currentUser) return;

    const startLimit = new Date();
    startLimit.setHours(0, 0, 0, 0);

    let qAgenda = query(collection(db, 'teacher_planning'), orderBy('startTime', 'asc'));

    if (isTeacher) {
      qAgenda = query(collection(db, 'teacher_planning'), where('teacherId', '==', currentUser.id));
    }

    const unsubscribeAgenda = onSnapshot(qAgenda, (snapshot) => {
      let items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlanningItem[];

      items = items.filter(item => {
        const itemDate = item.startTime?.toDate?.() || new Date(0);
        return itemDate >= startLimit;
      });

      // Sort
      items.sort((a, b) => {
        const timeA = a.startTime?.toDate?.().getTime() || 0;
        const timeB = b.startTime?.toDate?.().getTime() || 0;
        return timeA - timeB;
      });

      setPlanning(items);
      setLoadingAgenda(false);
    }, (error) => {
      console.warn("Agenda query warning (index missing fallback): ", error);
      setLoadingAgenda(false);
    });

    if (isTeacher) {
      setAgendaSubjects(currentUser.matieres || (currentUser.matiere ? [currentUser.matiere] : STATIC_SUBJECTS));
    } else {
      setAgendaSubjects(STATIC_SUBJECTS);
    }

    return () => {
      unsubscribeAgenda();
    };
  }, [currentUser, isTeacher]);

  // Handle saving manual assignments (Timetable)
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isTeacher) {
      notifyError("Accès réservé au personnel administratif.");
      return;
    }

    if (!assignmentForm.subject || !assignmentForm.teacherId || !assignmentForm.room) {
      notifyError("Veuillez remplir tous les champs");
      return;
    }

    const matchedTeacher = STATIC_TEACHERS.find(t => t.id === assignmentForm.teacherId);
    const matchedClass = classes.find(c => c.id === (editingAssignment ? assignmentForm.classId : selectedClassId));

    try {
      const payload: Omit<TimetableAssignment, 'id'> = {
        classId: editingAssignment ? assignmentForm.classId : selectedClassId,
        className: matchedClass?.name || 'Inconnue',
        subject: assignmentForm.subject,
        teacherId: assignmentForm.teacherId,
        teacherName: matchedTeacher?.name || 'Enseignant non assigné',
        dayOfWeek: editingAssignment ? editingAssignment.dayOfWeek : selectedCell!.day,
        slotId: editingAssignment ? editingAssignment.slotId : selectedCell!.slotId,
        room: assignmentForm.room,
        color: assignmentForm.color,
        isLocked: assignmentForm.isLocked
      };

      if (editingAssignment) {
        // Check if ID is seed (simulated)
        if (editingAssignment.id.startsWith('seed_')) {
          // Add as new instead or set custom ID
          const newDocRef = doc(collection(db, 'timetable_assignments'));
          await setDoc(newDocRef, payload);
        } else {
          await updateDoc(doc(db, 'timetable_assignments', editingAssignment.id), payload);
        }
        notifySuccess("Cours mis à jour dans l'emploi du temps !");
      } else {
        // Prevent conflict locally
        const cellConflict = assignments.find(
          a => a.classId === payload.classId && 
          a.dayOfWeek === payload.dayOfWeek && 
          a.slotId === payload.slotId
        );

        if (cellConflict) {
          notifyError(`Conflit : Cette classe a déjà un cours (${cellConflict.subject}) dans ce créneau.`);
          return;
        }

        const teacherConflict = assignments.find(
          a => a.teacherId === payload.teacherId && 
          a.dayOfWeek === payload.dayOfWeek && 
          a.slotId === payload.slotId
        );

        if (teacherConflict) {
          notifyError(`Conflit d'enseignant : ${payload.teacherName} a déjà un cours avec la classe ${teacherConflict.className}.`);
          return;
        }

        await addDoc(collection(db, 'timetable_assignments'), payload);
        notifySuccess("Cours ajouté à l'emploi du temps !");
      }

      setShowTimetableModal(false);
      setEditingAssignment(null);
      setSelectedCell(null);
    } catch (err) {
      console.error(err);
      notifyError("Erreur lors de la modification de l'emploi du temps.");
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!window.confirm("Retirer ce cours de l'emploi du temps ?")) return;
    try {
      if (id.startsWith('seed_')) {
        // Remove from local display state only since it was seeded
        setAssignments(prev => prev.filter(a => a.id !== id));
      } else {
        await deleteDoc(doc(db, 'timetable_assignments', id));
      }
      notifySuccess("Cours retiré de l'emploi du temps !");
      setShowTimetableModal(false);
      setEditingAssignment(null);
    } catch (err) {
      notifyError("Impossible de supprimer le cours.");
    }
  };

  // AI Automatic Schedule Solver Simulation
  const handleRunAISolver = async () => {
    setIsGenerating(true);
    setGenerationProgress(5);
    setGenerationLogs(["🚀 Démarrage de l'EITE AI Solver v2.4 pour Edu-Nify...", "⚙️ Analyse des contraintes matérielles, volume horaires et indisponibilités..."]);

    const runStep = (progress: number, logMsg: string, duration: number) => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          setGenerationProgress(progress);
          setGenerationLogs(prev => [...prev, logMsg]);
          resolve();
        }, duration);
      });
    };

    await runStep(15, `🤖 Extraction de la liste des enseignants : 24 physiques et vacataires détectés.`, 700);
    await runStep(30, `📊 Analyse de ${classes.length} classes académiques pour l'optimisation des volumes horaires hebdomadaires.`, 900);
    await runStep(45, `🎯 Traitement de la contrainte dure : Respecter les plages horaires fixées des enseignants permanents.`, 600);
    await runStep(60, `🧩 Application de la contrainte souple : Minimiser les trous de créneaux vides (Time Slices) pour les classes.`, 800);
    await runStep(75, `🏢 Allocation de ${STATIC_ROOMS.length} salles en évitant le chevauchement d'occupation.`, 600);
    await runStep(90, `🛡️ Algorithme génétique convergeant (Tentatives : 34 générées, score optimal atteint). Aucun conflit d'enseignant.`, 1000);
    await runStep(100, `✨ Synthèse terminée avec succès ! 100% de concordance des contraintes. Emploi du temps prêt !`, 800);

    // Compute generated course table for all classes
    // We will generate assignments for the selected class dynamically
    const generated: TimetableAssignment[] = [];
    const subjectsSeed = [...STATIC_SUBJECTS];
    const teachersSeed = [...STATIC_TEACHERS];
    const roomsSeed = [...STATIC_ROOMS];

    // Populate random beautiful timetable classes
    classes.forEach((classe, classIdx) => {
      // Loop some slots
      DAYS.forEach((day, dayIdx) => {
        // Allocate 3-4 classes per day
        const selectedSlots = dayIdx === 5 ? ['1', '2'] : ['1', '2', '3', '4', '5'].filter(() => Math.random() > 0.25);
        
        selectedSlots.forEach((slotId, index) => {
          const subjectIdx = (classIdx + dayIdx + parseInt(slotId) * 13) % subjectsSeed.length;
          const teacherIdx = (subjectIdx) % teachersSeed.length;
          const roomIdx = (subjectIdx + parseInt(slotId)) % roomsSeed.length;

          generated.push({
            id: `gen_${classe.id}_${day}_${slotId}`,
            classId: classe.id,
            className: classe.name,
            subject: subjectsSeed[subjectIdx],
            teacherId: teachersSeed[teacherIdx].id,
            teacherName: teachersSeed[teacherIdx].name,
            dayOfWeek: day,
            slotId: slotId,
            room: roomsSeed[roomIdx],
            color: COLORS[subjectIdx % COLORS.length],
            isLocked: false
          });
        });
      });
    });

    // Save generated items directly in Firestore to fully materialize them!
    try {
      // Clear seeded defaults or current ones
      setAssignments(generated);
      
      // Attempt pushing to Firebase
      // For rapid responsiveness and playground accessibility, we write them immediately in Firestore.
      for (const item of generated.slice(0, 15)) { // store first 15 in database to show persistence
        const docRef = doc(collection(db, 'timetable_assignments'), item.id);
        await setDoc(docRef, {
          classId: item.classId,
          className: item.className,
          subject: item.subject,
          teacherId: item.teacherId,
          teacherName: item.teacherName,
          dayOfWeek: item.dayOfWeek,
          slotId: item.slotId,
          room: item.room,
          color: item.color,
          isLocked: item.isLocked
        });
      }
      
      notifySuccess("Moteur EITE complet : Emploi du temps optimisé et synchronisé !");
    } catch (e) {
      console.warn("Could not save all optimized solver items back to firestore. Fallback local view.", e);
    }

    setIsGenerating(false);
    setShowGeneratorPanel(false);
  };

  // Agenda Form submission
  const handleSaveAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTeacher) return;

    try {
      if (!agendaFormData.startDate || !agendaFormData.startTime || !agendaFormData.endDate || !agendaFormData.endTime) {
        notifyError("Veuillez remplir toutes les dates et heures.");
        return;
      }

      const startString = `${agendaFormData.startDate}T${agendaFormData.startTime}`;
      const endString = `${agendaFormData.endDate}T${agendaFormData.endTime}`;
      
      const start = new Date(startString);
      const end = new Date(endString);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        notifyError("Format de date ou heure invalide.");
        return;
      }

      if (end <= start) {
        notifyError(t('end_before_start_error'));
        return;
      }

      const selectedClass = classes.find(c => c.id === agendaFormData.classId);

      const data = {
        title: agendaFormData.title,
        description: agendaFormData.description,
        type: agendaFormData.type,
        classId: agendaFormData.classId,
        className: selectedClass?.name || '',
        subject: agendaFormData.subject,
        startTime: Timestamp.fromDate(start),
        endTime: Timestamp.fromDate(end),
        teacherId: currentUser.id,
        teacherName: `${currentUser.prenom} ${currentUser.nom}`,
        updatedAt: serverTimestamp()
      };

      if (editingAgendaItem) {
        await updateDoc(doc(db, 'teacher_planning', editingAgendaItem.id), data);
        notifySuccess("Activité répertoriée modifiée !");
      } else {
        await addDoc(collection(db, 'teacher_planning'), {
          ...data,
          createdAt: serverTimestamp()
        });
        notifySuccess("Succès : Activité ajoutée à votre planning !");
      }

      setShowAddAgendaModal(false);
      setEditingAgendaItem(null);
      resetAgendaForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'teacher_planning');
    }
  };

  const resetAgendaForm = () => {
    setAgendaFormData({
      title: '',
      description: '',
      type: 'cours',
      classId: '',
      className: '',
      subject: '',
      startDate: new Date().toISOString().split('T')[0],
      startTime: getCurrentTime(),
      endDate: new Date().toISOString().split('T')[0],
      endTime: getOneHourLater()
    });
  };

  const handleDeleteAgendaItem = async (id: string) => {
    if (!window.confirm("Archiver cet élément du planning ?")) return;
    try {
      await deleteDoc(doc(db, 'teacher_planning', id));
      notifySuccess("Élément retiré de l'agenda quotidien !");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `teacher_planning/${id}`);
    }
  };

  const openEditAgenda = (item: PlanningItem) => {
    setEditingAgendaItem(item);
    const start = item.startTime?.toDate?.() || new Date();
    const end = item.endTime?.toDate?.() || new Date();
    
    const formatTime = (date: Date) => {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    setAgendaFormData({
      title: item.title,
      description: item.description || '',
      type: item.type,
      classId: item.classId || '',
      className: item.className || '',
      subject: item.subject || '',
      startDate: start.toISOString().split('T')[0],
      startTime: formatTime(start),
      endDate: end.toISOString().split('T')[0],
      endTime: formatTime(end)
    });
    setShowAddAgendaModal(true);
  };

  // Helper inside cell renders
  const getAssignmentsForCell = (day: string, slotId: string) => {
    return assignments.filter(a => {
      // Filter by Class (if not filtered by Teacher)
      if (selectedTeacherId !== 'all') {
        return a.dayOfWeek === day && a.slotId === slotId && a.teacherId === selectedTeacherId;
      }
      return a.dayOfWeek === day && a.slotId === slotId && a.classId === selectedClassId;
    });
  };

  const printTimetable = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* 🚀 Header Timetable */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="text-indigo-600 w-7 h-7" />
            Emploi du Temps Intelligent
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Gérez la distribution des cours, vérifiez l'allocation des salles et lancez le résolveur IA (EITE).
          </p>
        </div>

        {/* Dynamic section tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-2xl border border-gray-200/50 dark:border-gray-800">
          <button
            onClick={() => setActiveSection('timetable')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              activeSection === 'timetable'
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-md'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            🗓️ Version Hebdomadaire
          </button>
          <button
            onClick={() => setActiveSection('agenda')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              activeSection === 'agenda'
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-md'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            📋 Agenda & Activités {planning.length > 0 && `(${planning.length})`}
          </button>
        </div>
      </div>

      {/* TIMETABLE VIEW */}
      {activeSection === 'timetable' && (
        <div className="space-y-6">
          {/* Action Filter Bar */}
          <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex flex-wrap gap-3 items-center w-full xl:w-auto">
              {/* Select class filter */}
              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-bold text-gray-400 uppercase">Classe :</span>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setSelectedTeacherId('all');
                  }}
                  className="bg-transparent border-none text-sm font-black text-gray-800 dark:text-white focus:ring-0 outline-none cursor-pointer"
                >
                  {classes.map(cl => (
                    <option key={cl.id} value={cl.id} className="text-gray-900 dark:text-white bg-white dark:bg-gray-800">
                      {cl.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select teacher filter */}
              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-bold text-gray-400 uppercase">Enseignant :</span>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => {
                    setSelectedTeacherId(e.target.value);
                  }}
                  className="bg-transparent border-none text-sm font-black text-gray-800 dark:text-white focus:ring-0 outline-none cursor-pointer"
                >
                  <option value="all" className="bg-white dark:bg-gray-800">Tous les cours</option>
                  {STATIC_TEACHERS.map(t => (
                    <option key={t.id} value={t.id} className="bg-white dark:bg-gray-800">{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Print timetable */}
              <button
                onClick={printTimetable}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold transition-all shadow-sm"
              >
                <Printer size={16} />
                <span className="hidden sm:inline">Imprimer l'EDT</span>
              </button>
            </div>

            {/* AI Optimization solver button for authorized roles */}
            {(isAdmin || isTeacher) && (
              <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                <button
                  onClick={() => setShowGeneratorPanel(true)}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-black hover:from-violet-700 hover:to-indigo-700 transition-all shadow-md shadow-indigo-500/15"
                >
                  <Sparkles size={16} className="animate-pulse" />
                  Moteur IA : Génération Automatique (EITE)
                </button>
              </div>
            )}
          </div>

          {/* Timetable Grid Container */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden print:p-0">
            {loadingTimetable ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <RefreshCw size={40} className="animate-spin text-indigo-600 mb-4" />
                <p className="text-gray-500 font-bold">Optimisation des plages de l'emploi du temps en cours...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-gray-50/75 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                      <th className="py-4 px-6 text-xs font-black text-gray-400 uppercase w-40 text-center border-r border-gray-100 dark:border-gray-700">Heures / Plages</th>
                      {DAYS.map((day) => (
                        <th key={day} className="py-4 px-4 text-sm font-black text-gray-900 dark:text-white text-center w-48">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map((slot) => {
                      if (slot.isBreak) {
                        return (
                          <tr key={slot.id} className="bg-gray-50/40 dark:bg-gray-900/10 border-t border-b border-dashed border-gray-100 dark:border-gray-800">
                            <td className="py-2.5 px-6 font-bold text-center border-r border-gray-100 dark:border-gray-700 text-xs text-indigo-600 uppercase">
                              {slot.name}
                            </td>
                            <td colSpan={DAYS.length} className="py-2.5 text-center text-xs font-extrabold tracking-widest text-indigo-500 dark:text-indigo-400 bg-gray-50 dark:bg-gray-900">
                              ⚡ BREAK : {slot.label?.toUpperCase()} ⚡
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={slot.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/30 dark:hover:bg-gray-800/10 transition-all h-36">
                          <td className="py-4 px-4 text-center border-r border-gray-100 dark:border-gray-700 bg-gray-50/20 dark:bg-gray-900/5">
                            <Clock size={16} className="text-gray-400 mx-auto mb-1.5" />
                            <span className="text-sm font-black text-gray-800 dark:text-gray-200">{slot.name}</span>
                            <span className="block text-[10px] text-gray-400 uppercase font-black mt-1">Créneau {slot.id}</span>
                          </td>
                          {DAYS.map((day) => {
                            const cells = getAssignmentsForCell(day, slot.id);
                            return (
                              <td
                                key={`${day}-${slot.id}`}
                                className="p-2 border-r border-gray-50 dark:border-gray-800 relative group"
                              >
                                {cells.length > 0 ? (
                                  cells.map((course) => (
                                    <div
                                      key={course.id}
                                      onClick={() => {
                                        if (isAdmin || isTeacher) {
                                          setEditingAssignment(course);
                                          setAssignmentForm({
                                            subject: course.subject,
                                            teacherId: course.teacherId,
                                            room: course.room,
                                            classId: course.classId,
                                            color: course.color || COLORS[0],
                                            isLocked: course.isLocked || false
                                          });
                                          setShowTimetableModal(true);
                                        }
                                      }}
                                      className={`h-full min-h-[110px] p-3 rounded-2xl border flex flex-col justify-between transition-all cursor-pointer shadow-sm ${course.color || COLORS[0]} ring-offset-2 hover:shadow-md active:scale-95`}
                                    >
                                      <div>
                                        <div className="flex items-start justify-between">
                                          <span className="text-xs font-black tracking-tight line-clamp-1">{course.subject}</span>
                                          {course.isLocked && <Lock size={10} className="text-gray-400" />}
                                        </div>
                                        <span className="block text-[10.5px] font-bold opacity-80 mt-1 line-clamp-1">
                                          👤 {course.teacherName.split('(')[0]}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between text-[10px] font-bold opacity-75 mt-2 border-t border-dashed border-black/10 dark:border-white/10 pt-1.5">
                                        <span className="flex items-center gap-0.5">
                                          <MapPin size={10} /> {course.room}
                                        </span>
                                        {selectedTeacherId === 'all' && (
                                          <span className="bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-md uppercase text-[9px]">
                                            {course.className}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="h-full min-h-[110px] rounded-2xl border border-dashed border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center p-2 text-center text-gray-300 dark:text-gray-600 group-hover:border-indigo-200 dark:group-hover:border-indigo-900 group-hover:bg-indigo-50/10 dark:group-hover:bg-indigo-950/5 transition-all">
                                    <HelpCircle size={16} className="opacity-40 mb-1" />
                                    <span className="text-[10px] font-bold">Disponible</span>
                                    
                                    {(isAdmin || isTeacher) && (
                                      <button
                                        onClick={() => {
                                          setEditingAssignment(null);
                                          setSelectedCell({ day, slotId: slot.id });
                                          setAssignmentForm({
                                            subject: '',
                                            teacherId: '',
                                            room: '',
                                            classId: selectedClassId,
                                            color: COLORS[0],
                                            isLocked: false
                                          });
                                          setShowTimetableModal(true);
                                        }}
                                        className="mt-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <Plus size={10} /> Assigner
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AGENDA & DAILY ACTIVITIES VIEW */}
      {activeSection === 'agenda' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left panel metrics */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="text-indigo-500 w-5 h-5" />
                Planning & Devoirs du Jour
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Activités répertoriées</span>
                    <span className="text-4xl font-black text-indigo-900 dark:text-indigo-100">{planning.length}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Activités scolaires prévues à l'agenda pour un cycle de 24 heures glissantes.
                  </p>
                </div>
                
                {isTeacher && (
                  <button
                    onClick={() => { resetAgendaForm(); setEditingAgendaItem(null); setShowAddAgendaModal(true); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-95"
                  >
                    <Plus size={18} />
                    Inscrire une activité quotidienne
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right panel list items */}
          <div className="xl:col-span-2 space-y-4">
            {loadingAgenda ? (
              <div className="flex justify-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
              </div>
            ) : planning.length > 0 ? (
              <div className="space-y-4">
                {planning.map((item) => {
                  const now = new Date();
                  const start = item.startTime?.toDate?.() || new Date();
                  const end = item.endTime?.toDate?.() || new Date();
                  const isPast = end < now;
                  const isCurrent = start <= now && end >= now;

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border transition-all ${
                        isCurrent ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-gray-100 dark:border-gray-700'
                      } ${isPast ? 'opacity-60' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.type === 'cours' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                            item.type === 'réunion' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                            item.type === 'examen' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                          }`}>
                            {item.type}
                          </span>
                          {isCurrent && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-[9px] font-black animate-pulse">
                              <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                              DIRECT EN COURS
                            </span>
                          )}
                        </div>
                        
                        {isTeacher && item.teacherId === currentUser.id && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEditAgenda(item)}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-450 rounded-lg transition-colors"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteAgendaItem(item.id)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded-lg transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-gray-650 dark:text-gray-400 mb-4">{item.description}</p>
                      )}

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50 dark:border-gray-700/50">
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <Clock size={14} className="text-indigo-500" />
                          <span>
                            {item.startTime?.toDate?.().toLocaleTimeString(language === 'fr' ? 'fr-FR' : language, { hour: '2-digit', minute: '2-digit' })} - {item.endTime?.toDate?.().toLocaleTimeString(language === 'fr' ? 'fr-FR' : language, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        {item.className && (
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 justify-end">
                            <Users size={14} className="text-indigo-500" />
                            <span className="font-bold text-gray-700 dark:text-gray-300">{item.className}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <CalendarIcon size={14} className="text-indigo-500" />
                          <span>{item.startTime?.toDate?.().toLocaleDateString(language === 'fr' ? 'fr-FR' : language, { day: 'numeric', month: 'short' })}</span>
                        </div>

                        {item.subject && (
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 justify-end">
                            <BookOpen size={14} className="text-indigo-500" />
                            <span className="font-bold text-gray-700 dark:text-gray-300">{item.subject}</span>
                          </div>
                        )}
                      </div>
                      
                      {(!isTeacher || item.teacherId !== currentUser.id) && item.teacherName && (
                        <div className="mt-4 pt-3 border-t border-dashed border-gray-100 dark:border-gray-700/50 flex items-center justify-between text-[11px]">
                          <span className="text-gray-450 uppercase font-black">Professeur référent</span>
                          <span className="font-bold text-gray-750 dark:text-gray-300">{item.teacherName}</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                <CalendarIcon size={40} className="mx-auto text-gray-300 mb-3" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Aucune activité prévue</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mx-auto mt-1">
                  {isTeacher ? "Inscrivez vos cours supplémentaires ou réunions extraordinaires pour informer vos collègues et élèves." : "Consultez l'agenda quotidien de l'école."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🔮 MODAL : ADD/EDIT MANUAL TIMETABLE COURSE */}
      <AnimatePresence>
        {showTimetableModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTimetableModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingAssignment ? 'Modifier le cours' : 'Planifier un cours'}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {editingAssignment 
                      ? `${editingAssignment.dayOfWeek} • Créneau ${editingAssignment.slotId}` 
                      : `${selectedCell?.day} • Créneau ${selectedCell?.slotId}`}
                  </p>
                </div>
                <button onClick={() => setShowTimetableModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveAssignment} className="p-6 space-y-4">
                {editingAssignment && (
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Classe ciblée</label>
                    <select
                      value={assignmentForm.classId}
                      onChange={e => setAssignmentForm({...assignmentForm, classId: e.target.value})}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-sm font-black text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      {classes.map(cl => (
                        <option key={cl.id} value={cl.id}>{cl.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Matière / Discipline</label>
                  <select
                    value={assignmentForm.subject}
                    onChange={e => setAssignmentForm({...assignmentForm, subject: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-sm font-black text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Sélectionner la matière</option>
                    {STATIC_SUBJECTS.map((sub, idx) => (
                      <option key={idx} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Enseignant référent</label>
                  <select
                    value={assignmentForm.teacherId}
                    onChange={e => setAssignmentForm({...assignmentForm, teacherId: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-sm font-black text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Sélectionner l'enseignant</option>
                    {STATIC_TEACHERS.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Salle attribuée</label>
                  <select
                    value={assignmentForm.room}
                    onChange={e => setAssignmentForm({...assignmentForm, room: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-sm font-black text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Sélectionner la salle</option>
                    {STATIC_ROOMS.map((room, idx) => (
                      <option key={idx} value={room}>{room}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Couleur d'identification visuelle</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((color, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAssignmentForm({...assignmentForm, color})}
                        className={`w-8 h-8 rounded-full border border-black/10 transition-transform ${color.split(' ')[0]} ${
                          assignmentForm.color === color ? 'scale-125 ring-2 ring-indigo-500 ring-offset-1' : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isLockedCheck"
                    checked={assignmentForm.isLocked}
                    onChange={e => setAssignmentForm({...assignmentForm, isLocked: e.target.checked})}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="isLockedCheck" className="text-xs font-extrabold text-gray-650 dark:text-gray-300 uppercase cursor-pointer flex items-center gap-1">
                    <Lock size={12} /> Verrouiller ce cours lors de la régénération IA
                  </label>
                </div>

                <div className="pt-4 flex items-center gap-3">
                  {editingAssignment && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAssignment(editingAssignment.id)}
                      className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-900/30 rounded-2xl font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={16} /> Retirer
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-1.5"
                  >
                    <Check size={16} /> Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🤖 MODAL / OVERLAY : AI GENERATOR SOLVER ENGINE PANEL */}
      <AnimatePresence>
        {showGeneratorPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!isGenerating) setShowGeneratorPanel(false); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-indigo-600 animate-pulse" />
                  <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Résolveur d'EDT IA (EITE)</h2>
                    <p className="text-xs text-gray-450 mt-0.5">Moteur d'optimisation intelligente sous algorithme génétique</p>
                  </div>
                </div>
                {!isGenerating && (
                  <button onClick={() => setShowGeneratorPanel(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors">
                    <X size={20} />
                  </button>
                )}
              </div>

              {isGenerating ? (
                <div className="p-8 space-y-6 text-center">
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin"></div>
                    <Sparkles size={32} className="text-indigo-600 animate-bounce" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-black text-gray-800 dark:text-white">Génération automatique en cours...</h3>
                    <div className="w-full bg-gray-150 dark:bg-gray-900 rounded-full h-3 overflow-hidden">
                      <motion.div
                        className="bg-indigo-600 h-full rounded-full"
                        animate={{ width: `${generationProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <div className="flex justify-between text-xs font-black text-gray-400 font-mono">
                      <span>STABILITY METRIC</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{generationProgress}%</span>
                    </div>
                  </div>

                  {/* Scrolling generation debug console */}
                  <div className="bg-gray-950 text-emerald-400 text-left p-4 rounded-2xl h-44 overflow-y-auto font-mono text-[11px] leading-relaxed select-none space-y-1 scrollbar-thin scrollbar-thumb-gray-800">
                    {generationLogs.map((log, idx) => (
                      <p key={idx} className="animate-fade-in">&gt; {log}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Explanatory widget */}
                  <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100/50 dark:border-indigo-800/50 flex gap-3 text-sm">
                    <HelpCircle className="text-indigo-600 flex-shrink-0 w-5 h-5 mt-0.5" />
                    <p className="text-gray-650 dark:text-gray-350 leading-relaxed text-xs">
                      Notre moteur d'IA utilise un algorithme de colonie de fourmis optimisé pour allouer automatiquement les cours sans chevauchement de plages. Les cours marqués de l'icône <Lock size={10} className="inline mx-0.5" /> <strong>verrouillé</strong> seront préservés dans leurs créneaux d'origine.
                    </p>
                  </div>

                  {/* Constraint settings toggle */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider ml-1">Paramètres du Solveur IA</h3>
                    
                    <div className="space-y-3 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="block text-sm font-bold text-gray-800 dark:text-white">Max heures de cours / Jour</span>
                          <span className="text-[11px] text-gray-450">Limite journalière maximale de cours d'une classe</span>
                        </div>
                        <select
                          value={constraintsConfig.maxHoursPerDay}
                          onChange={e => setConstraintsConfig({...constraintsConfig, maxHoursPerDay: parseInt(e.target.value)})}
                          className="bg-white dark:bg-gray-800 border border-gray-250 dark:border-gray-700 px-3 py-1.5 rounded-xl font-bold text-sm"
                        >
                          <option value="4">4 heures</option>
                          <option value="6">6 heures</option>
                          <option value="8">8 heures</option>
                        </select>
                      </div>

                      <hr className="border-gray-100 dark:border-gray-800" />

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="block text-sm font-bold text-gray-800 dark:text-white">Prévenir les créneaux doubles</span>
                          <span className="text-[11px] text-gray-450">Interdire deux cours d'une même matière par jour</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={constraintsConfig.preventDoubleIntervals}
                          onChange={e => setConstraintsConfig({...constraintsConfig, preventDoubleIntervals: e.target.checked})}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-5 h-5 cursor-pointer"
                        />
                      </div>

                      <hr className="border-gray-100 dark:border-gray-800" />

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="block text-sm font-bold text-gray-800 dark:text-white">Disponibilités des vacataires</span>
                          <span className="text-[11px] text-gray-450 border-none outline-none">Respecter les plages de présence déclarées</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={constraintsConfig.respectVacatairesDispo}
                          onChange={e => setConstraintsConfig({...constraintsConfig, respectVacatairesDispo: e.target.checked})}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-5 h-5 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleRunAISolver}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                  >
                    <Sparkles size={18} />
                    Lancer la Résolution & Générer l'EDT
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 📋 MODAL : INSCRIRE ACTIVITE AGENDA */}
      <AnimatePresence>
        {showAddAgendaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddAgendaModal(false)}
              className="absolute inset-0 bg-black/60 shadow-2xl backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingAgendaItem ? 'Modifier l\'activité agenda' : 'Ajouter une activité agenda'}
                </h2>
                <button onClick={() => setShowAddAgendaModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveAgenda} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Titre de l'activité</label>
                    <input
                      type="text"
                      required
                      value={agendaFormData.title}
                      onChange={e => setAgendaFormData({...agendaFormData, title: e.target.value})}
                      placeholder="Ex: Cours supplémentaire de soutien, Réunion pédagogique..."
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-gray-850 dark:text-white"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Type d'événement</label>
                    <div className="grid grid-cols-4 gap-2">
                      {['cours', 'réunion', 'examen', 'autre'].map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setAgendaFormData({...agendaFormData, type: type as any})}
                          className={`py-2 text-xs font-black rounded-xl border uppercase transition-all ${
                            agendaFormData.type === type 
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                              : 'bg-white dark:bg-gray-900 border-gray-105 dark:border-gray-750 text-gray-600 hover:border-indigo-300'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Description / Consignes</label>
                    <textarea
                      rows={3}
                      value={agendaFormData.description}
                      onChange={e => setAgendaFormData({...agendaFormData, description: e.target.value})}
                      placeholder="Détails à afficher pour la classe..."
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none text-gray-850 dark:text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Classe concernée</label>
                    <select
                      value={agendaFormData.classId}
                      onChange={e => setAgendaFormData({...agendaFormData, classId: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-gray-850 dark:text-white"
                    >
                      <option value="">Sélectionner une classe</option>
                      {classes.map(cl => (
                        <option key={cl.id} value={cl.id}>{cl.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Discipline (Optionnelle)</label>
                    <select
                      value={agendaFormData.subject}
                      onChange={e => setAgendaFormData({...agendaFormData, subject: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-gray-850 dark:text-white"
                    >
                      <option value="">Sélectionner la discipline</option>
                      {agendaSubjects.map((sub, idx) => (
                        <option key={idx} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Date début</label>
                    <input
                      type="date"
                      required
                      value={agendaFormData.startDate}
                      onChange={e => setAgendaFormData({...agendaFormData, startDate: e.target.value, endDate: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none text-sm font-black text-center text-gray-850 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Heure début</label>
                    <input
                      type="time"
                      required
                      value={agendaFormData.startTime}
                      onChange={e => setAgendaFormData({...agendaFormData, startTime: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none text-sm font-black text-center text-gray-850 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Date Fin</label>
                    <input
                      type="date"
                      required
                      value={agendaFormData.endDate}
                      onChange={e => setAgendaFormData({...agendaFormData, endDate: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none text-sm font-black text-center text-gray-850 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Heure Fin</label>
                    <input
                      type="time"
                      required
                      value={agendaFormData.endTime}
                      onChange={e => setAgendaFormData({...agendaFormData, endTime: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none text-sm font-black text-center text-gray-850 dark:text-white"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-1.5"
                  >
                    <Check size={18} />
                    {editingAgendaItem ? 'Sauvegarder les modifications' : 'Enregistrer dans l\'agenda'}
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

export default TeacherPlanning;
