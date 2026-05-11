import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  TrendingUp, 
  RefreshCw, 
  AlertTriangle, 
  ShieldCheck, 
  GraduationCap, 
  Heart, 
  Activity, 
  Sparkles, 
  Award, 
  Castle,
  BookOpen,
  Calendar as CalendarIcon,
  MessageSquare,
  ClipboardCheck,
  Layout,
  ListTodo,
  Plus,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { collection, getDocs, query, where, onSnapshot, limit, orderBy, updateDoc, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import LiveClock from '../components/LiveClock';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import NewUserAnnouncement from '../components/NewUserAnnouncement';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// --- Sub-components for better organization ---

const AdminDashboard = ({ stats, weeklyData, studentLevelData, userDistribution, classData, recommendation, houses, alerts, ecoStats, mood, handleMoodSelect, t, tData }: any) => (
  <div className="space-y-6">
    {/* Insights Row */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Wellbeing */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-xl overflow-hidden relative group">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md"><Activity size={20} /></div>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{t('wellbeing')}</span>
          </div>
          <h3 className="text-lg font-black mb-1">{t('how_are_you')}</h3>
          <p className="text-xs opacity-80 mb-4">{t('mood_desc')}</p>
          <div className="flex justify-between gap-2">
            {['😊', '😐', '😔', '😡'].map(m => (
              <button key={m} onClick={() => handleMoodSelect(m)} className={`flex-1 aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${mood === m ? 'bg-white text-indigo-600' : 'bg-white/10 hover:bg-white/20'}`}>{m}</button>
            ))}
          </div>
        </div>
        <Sparkles className="absolute -bottom-4 -right-4 w-24 h-24 text-white/10 rotate-12" />
      </div>

      {/* Eco Impact */}
      <div className="bg-white dark:bg-gray-800 border border-emerald-100 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><ShieldCheck size={20} /></div>
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{t('eco_impact')}</span>
        </div>
        <div className="space-y-3">
          <p className="text-2xl font-black text-gray-900 dark:text-white">{ecoStats.trees} <span className="text-xs font-medium text-gray-400">Arbres</span></p>
          <div className="h-1.5 bg-emerald-50 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 w-[75%]" /></div>
          <p className="text-[10px] text-gray-400 uppercase font-bold">Économisés cette année</p>
        </div>
      </div>

      {/* AI recommendation */}
      <div className="bg-white dark:bg-gray-800 border border-orange-100 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-orange-50 text-orange-600 rounded-xl"><Sparkles size={20} /></div>
          <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">IA Insight</span>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed font-medium">
          {recommendation?.text || "Analyse des tendances en cours pour optimiser les performances de l'établissement."}
        </p>
      </div>

      {/* Competition */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-slate-800 rounded-xl"><Award size={20} className="text-yellow-400" /></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compétition</span>
        </div>
        <div className="space-y-2">
          {houses.slice(0, 3).map((house: any, idx: number) => (
            <div key={house.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded-xl border border-slate-700">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: house.color }}>{house.name}</span>
              <span className="font-black text-xs">{house.points} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Standard Stats */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Users /></div>
        <div><p className="text-sm font-medium text-gray-500">Effectif</p><h3 className="text-2xl font-bold">{stats.total}</h3></div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><UserCheck /></div>
        <div><p className="text-sm font-medium text-gray-500">Présents</p><h3 className="text-2xl font-bold">{stats.presents}</h3></div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center"><Clock /></div>
        <div><p className="text-sm font-medium text-gray-500">Retards</p><h3 className="text-2xl font-bold">{stats.retards}</h3></div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center"><UserX /></div>
        <div><p className="text-sm font-medium text-gray-500">Absents</p><h3 className="text-2xl font-bold">{stats.absents}</h3></div>
      </div>
    </div>

    {/* Charts */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold mb-6">Évolution hebdomadaire</h3>
        <div className="h-64"><ResponsiveContainer><BarChart data={weeklyData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="presents" fill="#10b981" /><Bar dataKey="retards" fill="#f59e0b" /><Bar dataKey="absents" fill="#ef4444" /></BarChart></ResponsiveContainer></div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold mb-6">Répartition par niveau</h3>
        <div className="h-64"><ResponsiveContainer><PieChart><Pie data={studentLevelData} innerRadius={60} outerRadius={80} dataKey="value" nameKey="name">{studentLevelData.map((_: any, index: number) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
      </div>
    </div>
  </div>
);

const TeacherDashboard = ({ currentUser, t, tData, onNavigate }: any) => {
  const [classes, setClasses] = useState<any[]>([]);
  const [studentCounts, setStudentCounts] = useState<{[key: string]: number}>({});
  const [recentAssignments, setRecentAssignments] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [myStats, setMyStats] = useState({ presenceRate: 98, lessonsGiven: 124, pendingGrading: 0 });
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    if (!currentUser) return;

    // Listen to teacher's classes
    const unsubClasses = onSnapshot(collection(db, 'classes'), (snapshot) => {
      const allClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const teacherClasses = allClasses.filter((c: any) => 
        currentUser.classes?.includes(c.nom) || c.professeur_principal_id === currentUser.id
      );
      setClasses(teacherClasses);
    });

    // Listen to students to calculate real-time counts per class
    const unsubStudents = onSnapshot(
      query(collection(db, 'users'), where('role', 'in', ['élève', 'eleve'])),
      (snapshot) => {
        const counts: {[key: string]: number} = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.classe) {
            counts[data.classe] = (counts[data.classe] || 0) + 1;
          }
        });
        setStudentCounts(counts);
      }
    );

    // Listen to recent homework assignments
    const unsubHomework = onSnapshot(
      collection(db, 'homework'),
      (snapshot) => {
        const homework = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((hw: any) => hw.teacher_id === currentUser.id)
          .sort((a: any, b: any) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
          })
          .slice(0, 5);
          
        setRecentAssignments(homework);
        setMyStats(prev => ({ ...prev, pendingGrading: homework.length * 3 }));
      },
      (error) => console.error("Index or permission error in homework:", error)
    );

    // Listen to personal tasks
    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), where('userId', '==', currentUser.id), where('status', '==', 'pending'), limit(5)),
      (snapshot) => {
        setMyTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => console.error("Task query error:", error)
    );

    // Listen to today's schedule
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const today = dayNames[new Date().getDay()];
    
    const unsubSchedule = onSnapshot(
      collection(db, 'timetables'),
      (snapshot) => {
        const slots = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((s: any) => s.professeur_id === currentUser.id && s.jour === today)
          .sort((a: any, b: any) => (a.heure_debut || "").localeCompare(b.heure_debut || ""));

        if (slots.length > 0) {
          setSchedule(slots);
        } else {
          setSchedule([
            { heure_debut: '08:00', matiere: 'Cours Principal', classe: '3ème A', color: 'bg-blue-600' },
            { heure_debut: '10:00', matiere: 'Soutien', classe: '2nde B', color: 'bg-purple-600' },
          ]);
        }
      },
      (error) => console.error("Index or permission error in schedule:", error)
    );

    return () => {
      unsubClasses();
      unsubStudents();
      unsubHomework();
      unsubTasks();
      unsubSchedule();
    };
  }, [currentUser]);

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: currentStatus === 'completed' ? 'pending' : 'completed',
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      await addDoc(collection(db, 'tasks'), {
        userId: currentUser.id,
        title: newTaskTitle,
        status: 'pending',
        priority: 'Normale',
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], // Default 3 days for demo
        createdAt: serverTimestamp()
      });
      setNewTaskTitle('');
      setIsTaskModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusInfo = (dueDateString: string) => {
    if (!dueDateString) return { color: 'bg-green-500', text: 'text-green-600', label: 'Ajouté', border: 'border-green-100', lightBg: 'bg-green-50' };
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDateString);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { color: 'bg-red-500', text: 'text-red-600', label: 'En retard', border: 'border-red-100', lightBg: 'bg-red-50' };
    if (diffDays === 0) return { color: 'bg-red-500', text: 'text-red-600', label: 'Aujourd\'hui', border: 'border-red-100', lightBg: 'bg-red-50' };
    if (diffDays <= 2) return { color: 'bg-orange-500', text: 'text-orange-600', label: 'Bientôt', border: 'border-orange-100', lightBg: 'bg-orange-50' };
    
    return { color: 'bg-green-500', text: 'text-green-600', label: 'Ajouté', border: 'border-green-100', lightBg: 'bg-green-50' };
  };

  return (
    <div className="space-y-6">
      {/* Teacher Welcoming */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-black mb-2">Bonjour, Prof. {currentUser?.nom} !</h2>
            <p className="text-blue-100 opacity-90 max-w-md">Prêt pour une nouvelle journée d'enseignement ? Voici un aperçu de vos classes et de vos tâches pédagogiques.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center flex-1">
              <BookOpen className="mx-auto mb-2 text-white/50" />
              <p className="text-2xl font-black">{classes.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Classes</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center flex-1 min-w-[100px]">
              <Users className="mx-auto mb-2 text-white/50" />
              <p className="text-2xl font-black">
                {classes.reduce((acc, cls) => acc + (studentCounts[cls.nom] || 0), 0)}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Étudiants</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center flex-1">
              <ClipboardCheck className="mx-auto mb-2 text-white/50" />
              <p className="text-2xl font-black">{myStats.presenceRate}%</p>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Présence</p>
            </div>
          </div>
        </div>
        <Layout className="absolute -bottom-10 -left-10 w-48 h-48 text-white/5 rotate-12" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Workspace */}
        <div className="lg:col-span-2 space-y-6">
          {/* My Classes */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black flex items-center gap-2">
                  <Users className="text-blue-600" size={20} />
                  Mes Classes
                </h3>
                <button 
                  onClick={() => onNavigate('classes')}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  Voir tout
                </button>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {classes.length > 0 ? classes.map(cls => (
                 <div key={cls.id} className="p-4 rounded-2xl border border-gray-50 bg-gray-50/50 hover:bg-white hover:shadow-md transition-all group">
                   <div className="flex justify-between items-start mb-3">
                     <div className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center font-black">{cls.nom}</div>
                     <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">Actif</span>
                   </div>
                   <h4 className="font-bold text-gray-900 mb-1">{cls.nom}</h4>
                   <p className="text-xs text-gray-500 mb-4">{studentCounts[cls.nom] || 0} Élèves Inscrits</p>
                   <button 
                     onClick={() => onNavigate('classes', { classId: cls.id })}
                     className="w-full py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all font-inter"
                    >
                     Suivi de Classe
                   </button>
                 </div>
               )) : (
                 <div className="col-span-full py-8 text-center text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                    <Users size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-xs font-bold italic">Aucune classe officiellement assignée</p>
                 </div>
               )}
             </div>
          </div>

          {/* Quick Tasks & Recent Homework */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
             <div className="flex items-center justify-between mb-6">
               <h3 className="text-lg font-black flex items-center gap-2">
                 <ListTodo className="text-purple-600" size={20} />
                 Tâches & Devoirs
               </h3>
               <button 
                 onClick={() => setIsTaskModalOpen(true)}
                 className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <Plus size={16} />
               </button>
             </div>
             
             {isTaskModalOpen && (
               <div className="mb-4 p-4 bg-purple-50 rounded-2xl border border-purple-100 animate-in fade-in slide-in-from-top-2">
                 <form onSubmit={handleAddTask} className="flex gap-2">
                   <input 
                     autoFocus
                     type="text" 
                     value={newTaskTitle}
                     onChange={(e) => setNewTaskTitle(e.target.value)}
                     placeholder="Nouvelle tâche..."
                     className="flex-1 bg-white border border-purple-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                   />
                   <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-bold">
                     Ajouter
                   </button>
                   <button type="button" onClick={() => setIsTaskModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                     <X size={16} />
                   </button>
                 </form>
               </div>
             )}
                {/* Real-time Homework */}
                {recentAssignments.map(hw => {
                  const status = getStatusInfo(hw.dueDate);
                  return (
                    <div key={hw.id} className={`flex items-center gap-4 p-4 rounded-2xl ${status.lightBg} border ${status.border} group cursor-pointer hover:shadow-sm transition-all`}>
                        <div className={`w-10 h-10 ${status.color} text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-black/5`}>
                          <ClipboardCheck size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-bold text-gray-900 truncate">{hw.title}</p>
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${status.color} text-white`}>
                              {status.label}
                            </span>
                          </div>
                          <p className={`text-[10px] ${status.text} font-medium`}>{hw.class_nom} • Échéance: {hw.dueDate}</p>
                        </div>
                        <ChevronRightIcon className={`${status.text} group-hover:translate-x-1 transition-transform`} />
                    </div>
                  );
                })}

                {/* Personal Tasks */}
                {myTasks.map(task => {
                  const status = getStatusInfo(task.dueDate);
                  return (
                    <div key={task.id} className={`flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 hover:border-purple-200 transition-all group relative overflow-hidden`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${status.color}`} />
                        <button 
                          onClick={() => handleToggleTask(task.id, task.status)}
                          className="w-6 h-6 border-2 border-purple-200 rounded-lg flex items-center justify-center group-hover:border-purple-500 transition-colors bg-white z-10"
                        >
                          {task.status === 'completed' && <div className="w-3 h-3 bg-purple-500 rounded-sm" />}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                             <p className={`text-sm font-bold ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</p>
                             {task.status !== 'completed' && (
                               <span className={`w-2 h-2 rounded-full animate-pulse ${status.color}`} />
                             )}
                          </div>
                          <p className="text-[10px] text-gray-500 font-medium flex items-center gap-2">
                            <span>Priorité: {task.priority || 'Normale'}</span>
                            {task.dueDate && <span>•</span>}
                            {task.dueDate && <span className={status.text}>Échéance: {task.dueDate}</span>}
                          </p>
                        </div>
                    </div>
                  );
                })}

                {recentAssignments.length === 0 && myTasks.length === 0 && (
                  <div className="py-6 text-center text-gray-400">
                    <p className="text-xs italic">Aucune tâche ou devoir récent</p>
                  </div>
                )}
             </div>
          </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
           {/* Schedule */}
           <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
             <h3 className="text-sm font-black mb-6 uppercase tracking-widest text-gray-400">Planning du jour</h3>
             <div className="space-y-4">
                {schedule.length > 0 ? schedule.map((slot, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="text-xs font-bold text-gray-400 w-10 shrink-0">{slot.heure_debut}</div>
                    <div className="flex-1 pb-4 border-l-2 border-gray-50 pl-4 relative">
                      <div className={`absolute left-[-5px] top-1 w-2 h-2 rounded-full ${slot.color || 'bg-gray-400'}`} />
                      <p className="text-xs font-black text-gray-900">{slot.matiere || slot.subject}</p>
                      <p className="text-[10px] text-gray-500 font-bold">{slot.classe || slot.class_nom}</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-6 text-gray-400 text-xs italic">
                    Aucun cours programmé aujourd'hui
                  </div>
                )}
             </div>
           </div>

           {/* Feedback */}
           <div className="bg-indigo-900 rounded-3xl p-6 text-white text-center">
             <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                <MessageSquare className="text-blue-400" size={24} />
             </div>
             <h3 className="font-black mb-2">Centre de Discussion</h3>
             <p className="text-xs text-indigo-200 mb-6 font-medium">Restez en contact avec l'administration et vos collègues.</p>
             <button 
               onClick={() => onNavigate('messaging')}
               className="w-full py-3 bg-white text-indigo-900 rounded-2xl font-black text-xs hover:bg-blue-50 transition-colors shadow-xl shadow-indigo-950/20"
             >
               Ouvrir la Messagerie
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};

const ChevronRightIcon = ({ className, size = 18 }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6"/></svg>
);

// --- Main Component ---

export default function Dashboard({ onNavigate }: any) {
  const { currentUser } = useAuth();
  const { t, tData } = useLanguage();
  const [stats, setStats] = useState({ presents: 0, retards: 0, absents: 0, total: 0 });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [studentLevelData, setStudentLevelData] = useState<any[]>([]);
  const [userDistribution, setUserDistribution] = useState<any[]>([]);
  const [classData, setClassData] = useState<any[]>([]);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ecoStats, setEcoStats] = useState({ trees: 0, water: 0, paper: 0 });
  const [mood, setMood] = useState<string | null>(null);
  const [houses, setHouses] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser || !isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    // Shared listeners (Eco, Wellbeing, Competition) - Only if Admin/Staff for full data
    const unsubEco = onSnapshot(collection(db, 'users'), (snapshot) => {
      const totalPaper = snapshot.size * 250;
      setEcoStats({ trees: parseFloat((totalPaper / 8333).toFixed(1)), paper: totalPaper, water: totalPaper * 10 });
    });
    
    const unsubWellbeing = onSnapshot(query(collection(db, 'wellbeing_logs'), where('userId', '==', currentUser.id), where('date', '==', today)), (snapshot) => {
      if (!snapshot.empty) setMood(snapshot.docs[0].data().mood);
    });

    const unsubHouses = onSnapshot(collection(db, 'houses'), (snapshot) => {
      setHouses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => (b.points || 0) - (a.points || 0)));
    });

    // Admin specific distribution & presence
    if (currentUser.role === 'admin' || currentUser.role === 'personnel administratif') {
      const unsubDashboard = onSnapshot(collection(db, 'users'), (userSnapshot) => {
        let expectedTotal = 0;
        let pCount = 0, eCount = 0, sCount = 0, parCount = 0;
        const usersMap = new Map();

        userSnapshot.forEach(doc => {
          const data = doc.data();
          usersMap.set(doc.id, data);
          const role = data.role?.toLowerCase();
          if (role === 'enseignant') pCount++;
          else if (role === 'élève' || role === 'eleve') eCount++;
          else if (role === 'admin' || role === 'personnel') sCount++;
          else if (role === 'parent') parCount++;

          if (['enseignant', 'élève', 'eleve', 'personnel', 'admin'].includes(role)) expectedTotal++;
        });

        setUserDistribution([
          { name: 'Enseignants', value: pCount, color: COLORS[0] },
          { name: 'Élèves', value: eCount, color: COLORS[1] },
          { name: 'Personnel', value: sCount, color: COLORS[3] },
          { name: 'Parents', value: parCount, color: COLORS[2] }
        ]);

        const levelMap = new Map();
        userSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.role === 'élève' || data.role === 'eleve') {
            const level = (data.classe || 'N/A').split(' ')[0];
            levelMap.set(level, (levelMap.get(level) || 0) + 1);
          }
        });
        setStudentLevelData(Array.from(levelMap.entries()).map(([name, value]) => ({ name, value })));

        // Today's attendance
        const unsubTodayAtt = onSnapshot(query(collection(db, 'attendance'), where('date', '==', today)), (snapshot) => {
          let prToday = 0, reToday = 0;
          snapshot.docs.forEach(doc => {
            const d = doc.data();
            if (usersMap.has(d.user_id)) {
              if (d.statut === 'Présent') prToday++;
              else if (d.statut === 'Retard') reToday++;
            }
          });
          setStats({ presents: prToday, retards: reToday, absents: Math.max(0, expectedTotal - (prToday + reToday)), total: expectedTotal });
        });

        setLoading(false);
        return () => unsubTodayAtt();
      });
      return () => { unsubEco(); unsubWellbeing(); unsubHouses(); unsubDashboard(); };
    } else {
      setLoading(false);
      return () => { unsubEco(); unsubWellbeing(); unsubHouses(); };
    }
  }, [currentUser]);

  const handleMoodSelect = async (selectedMood: string) => {
    setMood(selectedMood);
    // Logic for saving mood...
  };

  if (loading) return <div className="flex items-center justify-center p-12"><RefreshCw className="animate-spin text-indigo-600" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('dashboard')}</h1>
          <p className="text-sm text-gray-500 mt-1">Bonjour {currentUser?.prenom}, ravi de vous revoir !</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
          <LiveClock showDate={true} showTime={false} />
        </div>
      </div>

      <NewUserAnnouncement />

      {currentUser?.role === 'admin' || currentUser?.role === 'personnel administratif' ? (
        <AdminDashboard 
          stats={stats} 
          weeklyData={weeklyData} 
          studentLevelData={studentLevelData} 
          userDistribution={userDistribution}
          classData={classData}
          recommendation={recommendation}
          houses={houses}
          alerts={alerts}
          ecoStats={ecoStats}
          mood={mood}
          handleMoodSelect={handleMoodSelect}
          t={t}
          tData={tData}
        />
      ) : (
        <TeacherDashboard currentUser={currentUser} t={t} tData={tData} onNavigate={onNavigate} />
      )}
    </div>
  );
}
