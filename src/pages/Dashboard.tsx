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
  X,
  Settings as SettingsIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { collection, getDocs, query, where, onSnapshot, limit, orderBy, updateDoc, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import LiveClock from '../components/LiveClock';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import NewUserAnnouncement from '../components/NewUserAnnouncement';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// --- Sub-components for better organization ---

const MiniSparkline = ({ data, color }: { data: any[], color: string }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const safeData = data.map(d => ({
    ...d,
    value: isNaN(Number(d.value)) ? 0 : Number(d.value)
  }));

  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={safeData}>
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            fill={color} 
            fillOpacity={isDark ? 0.2 : 0.1} 
            strokeWidth={2} 
            animationDuration={2000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const AdminDashboard = ({ stats, weeklyData, studentLevelData, userDistribution, classData, recommendation, houses, alerts, ecoStats, mood, handleMoodSelect, t, tData }: any) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="space-y-6">
      {/* Top Indicators with Curves */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { icon: Users, label: 'Effectif Total', value: Number(stats.total) || 0, color: '#4f46e5', bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },
          { icon: UserCheck, label: 'Taux de Présence', value: `${(Number(stats.total) || 0) > 0 ? Math.round(((Number(stats.presents) || 0) / (Number(stats.total) || 0)) * 100) : 0}%`, color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400' },
          { icon: Clock, label: 'Moyenne Retards', value: Number(stats.retards) || 0, color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' },
          { icon: Award, label: 'Points Maisons', value: houses.reduce((acc: number, h: any) => acc + (Number(h.points) || 0), 0), color: '#8b5cf6', bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' }
        ].map((item, i) => {
          let sparkHistory = [];
          if (item.label === 'Effectif Total') {
            sparkHistory = [{value: Math.max(0, item.value * 0.9)}, {value: Math.max(0, item.value * 0.95)}, {value: Math.max(0, item.value * 0.98)}, {value: Math.max(0, item.value * 1.02)}, {value: item.value}];
          } else if (item.label === 'Taux de Présence' && weeklyData.length > 0) {
            sparkHistory = weeklyData.map(d => ({ value: (stats.total > 0 ? (d.presents / stats.total) * 100 : 0) }));
          } else if (item.label === 'Moyenne Retards' && weeklyData.length > 0) {
            sparkHistory = weeklyData.map(d => ({ value: Number(d.retards) || 0 }));
          } else {
            sparkHistory = [{value: 50}, {value: 70}, {value: 65}, {value: 80}, {value: item.value}];
          }

          // Ensure sparkHistory has at least 2 points for AreaChart to render correctly
          if (sparkHistory.length < 2) sparkHistory = [{value: 0}, {value: Number(item.value) || 0}];

          return (
            <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className={`w-12 h-12 ${item.bg} ${item.text} rounded-2xl flex items-center justify-center`}><item.icon size={24} /></div>
                <MiniSparkline data={sparkHistory} color={item.color} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{item.label}</p>
                <h3 className="text-3xl font-black text-gray-900 dark:text-white mt-1">{item.value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Ecosystem Chart */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
           <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6">Répartition par Secteur</h3>
           <div className="h-64">
             <ResponsiveContainer>
               <PieChart>
                 <Pie 
                   data={userDistribution} 
                   innerRadius={65} 
                   outerRadius={85} 
                   dataKey="value" 
                   nameKey="name" 
                   paddingAngle={5}
                   stroke="none"
                 >
                   {userDistribution.map((entry: any, index: number) => (
                     <Cell key={index} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: isDark ? '#1F2937' : '#FFFFFF', color: isDark ? '#F3F4F6' : '#111827', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                 />
                 <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px' }} />
               </PieChart>
             </ResponsiveContainer>
           </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mt-2">
              <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase">Users</span>
              <p className="text-3xl font-black text-gray-900 dark:text-white">{Number(stats.total) || 0}</p>
           </div>
        </div>

        {/* Weekly Curve Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white">Évolution des Présences</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Analyse comparative hebdomadaire</p>
              </div>
              <div className="flex gap-4 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                 <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/30" /><span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase">Présents</span></div>
                 <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-lg shadow-amber-500/30" /><span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase">Retards</span></div>
              </div>
           </div>
           <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="curvePresents" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/><stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/></linearGradient>
                    <linearGradient id="curveRetards" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#374151' : '#F3F4F6'} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 900 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#9CA3AF' : '#64748b', fontSize: 11, fontWeight: 900 }} />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      backgroundColor: isDark ? '#1F2937' : '#FFFFFF', 
                      color: isDark ? '#F3F4F6' : '#111827', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }} 
                  />
                  <Area type="monotone" dataKey="presents" stroke="#4f46e5" fill="url(#curvePresents)" strokeWidth={4} animationDuration={1500} dot={{ r: 4, strokeWidth: 2, fill: isDark ? '#1F2937' : '#FFFFFF' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="retards" stroke="#f59e0b" fill="url(#curveRetards)" strokeWidth={4} animationDuration={1500} dot={{ r: 4, strokeWidth: 2, fill: isDark ? '#1F2937' : '#FFFFFF' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* Class distribution indicators */}
      <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white">Densité par Classe</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Répartition réelle de l'effectif étudiant</p>
          </div>
          <button className="p-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl text-gray-400 hover:text-indigo-600 transition-colors">
            <TrendingUp size={20} />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {classData.length > 0 ? (
            classData.map((cls: any, i: number) => (
              <div key={i} className="space-y-4 p-5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 opacity-0 animate-fade-in transition-all hover:border-indigo-200 dark:hover:border-indigo-800 hover:translate-y-[-2px] group" style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'forwards' }}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/50 px-2 py-1 rounded-md">{cls.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Live</span>
                  </div>
                </div>
                
                <div className="flex items-end justify-between gap-2">
                   <div className="min-w-0">
                     <h4 className="text-3xl font-black text-gray-900 dark:text-white truncate">{Number(cls.students) || 0}</h4>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Élèves</p>
                   </div>
                   <div className="w-12 h-12 shrink-0 group-hover:scale-110 transition-transform">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={[{value: Number(cls.students) || 0}, {value: Math.max(0, (Number(stats.total) || 100) - (Number(cls.students) || 0))}]} 
                            dataKey="value" 
                            innerRadius={18} 
                            outerRadius={24} 
                            startAngle={90} 
                            endAngle={450} 
                            stroke="none"
                            paddingAngle={2}
                          >
                            <Cell fill={COLORS[i % COLORS.length]} />
                            <Cell fill={isDark ? '#374151' : '#E5E7EB'} />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                   </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase">
                    <span>Occupation</span>
                    <span className="text-gray-900 dark:text-white">{cls.percentage}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${cls.percentage}%` }}
                      className="h-full rounded-full transition-all duration-1000 shadow-md" 
                      style={{ 
                        backgroundColor: COLORS[i % COLORS.length] 
                      }} 
                    />
                  </div>
                </div>
              </div>
            ))
          ) : (
             <div className="col-span-full py-16 text-center">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300 dark:text-gray-600">
                  <Activity size={24} />
                </div>
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Initialisation des flux de données...</p>
             </div>
          )}
        </div>
      </div>
      
      {/* Lower Row: AI Insights & Competition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* AI Card */}
         <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden group">
            <div className="relative z-10 flex flex-col h-full">
               <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-xl"><Sparkles size={24} /></div>
                  <div className="px-3 py-1 bg-white/20 rounded-full backdrop-blur-xl text-[10px] font-black uppercase tracking-widest text-white/90">Analyse IA</div>
               </div>
               <h3 className="text-2xl font-black mb-2">Recommandation Stratégique</h3>
               <p className="text-indigo-100 font-medium leading-relaxed mb-8">
                  {recommendation?.text || "Vos indicateurs montrent une corrélation forte entre la ponctualité matinale et les taux de réussite. Envisagez un programme d'encouragement ciblé."}
               </p>
               <div className="mt-auto flex gap-4">
                  <button className="flex-1 py-3 bg-white text-indigo-600 rounded-2xl font-black text-sm hover:bg-white/90 transition-colors">Détails</button>
                  <button className="flex-1 py-3 bg-white/10 text-white rounded-2xl font-black text-sm hover:bg-white/20 transition-colors border border-white/20">Optimiser</button>
               </div>
            </div>
            <Layout className="absolute -bottom-8 -right-8 w-40 h-40 text-black/5" />
         </div>

         {/* House Leaderboard */}
         <div className="bg-slate-900 p-8 rounded-3xl shadow-xl relative overflow-hidden">
            <h3 className="text-xl font-black text-white mb-8 border-b border-white/10 pb-4">Championnat des Maisons</h3>
            <div className="space-y-4">
               {houses.length > 0 ? houses.sort((a: any, b: any) => b.points - a.points).map((house: any, i: number) => (
                  <div key={house.id} className="group flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-white/20 transition-all">
                     <div className="w-8 h-8 rounded-xl font-black text-slate-500 flex items-center justify-center text-xs group-hover:text-white transition-colors">{i + 1}</div>
                     <div className="w-2 h-10 rounded-full" style={{ backgroundColor: house.color }} />
                     <div className="flex-1">
                        <p className="text-sm font-black text-white">{house.name}</p>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
                           <div className="h-full rounded-full transition-all" style={{ width: `${(Number(houses[0]?.points) || 0) > 0 ? ((Number(house.points) || 0) / (Number(houses[0].points) || 0)) * 100 : 0}%`, backgroundColor: house.color }} />
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-lg font-black text-white">{house.points}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Points</p>
                     </div>
                  </div>
               )) : (
                  <div className="py-12 text-center text-slate-500 text-xs italic">Aucune donnée de points disponible</div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
};

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
            <h2 className="text-3xl font-black mb-2 lowercase first-letter:uppercase">{t('teacher_greeting')} {currentUser?.prenom} {currentUser?.nom} !</h2>
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
            <button 
              onClick={() => onNavigate('settings')}
              className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center flex-1 hover:bg-white/20 transition-all group"
            >
              <SettingsIcon className="mx-auto mb-2 text-white/50 group-hover:rotate-90 transition-transform" />
              <p className="text-2xl font-black">...</p>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Paramètres</p>
            </button>
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
      // Calculate last 5 days for weekly data
      const last5Days = Array.from({length: 5}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (4 - i));
        return d.toISOString().split('T')[0];
      });

      const unsubWeeklyAtt = onSnapshot(
        query(collection(db, 'attendance'), where('date', 'in', last5Days)),
        (snapshot) => {
          const countsByDay: {[key: string]: {presents: number, retards: number, absents: number}} = {};
          last5Days.forEach(day => countsByDay[day] = {presents: 0, retards: 0, absents: 0});
          
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (countsByDay[data.date]) {
              if (data.statut === 'Présent') countsByDay[data.date].presents++;
              else if (data.statut === 'Retard') countsByDay[data.date].retards++;
            }
          });

          const dayLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
          const history = last5Days.map(day => {
            const dateObj = new Date(day);
            return {
              name: dayLabels[dateObj.getDay()],
              presents: countsByDay[day].presents,
              retards: countsByDay[day].retards,
              date: day
            };
          });
          setWeeklyData(history);
        }
      );

      const unsubDashboard = onSnapshot(collection(db, 'users'), (userSnapshot) => {
        let expectedTotal = 0;
        let pCount = 0, eCount = 0, sCount = 0, parCount = 0;
        const usersMap = new Map();
        const countsByClass: {[key: string]: number} = {};

        userSnapshot.forEach(doc => {
          const data = doc.data();
          usersMap.set(doc.id, data);
          const role = data.role?.toLowerCase() || '';
          
          if (role === 'enseignant') pCount++;
          else if (role === 'élève' || role === 'eleve') {
            eCount++;
            if (data.classe) {
              countsByClass[data.classe] = (countsByClass[data.classe] || 0) + 1;
            }
          }
          else if (role === 'admin' || role === 'personnel' || role === 'personnel administratif') sCount++;
          else if (role === 'parent') parCount++;

          if (['enseignant', 'élève', 'eleve', 'personnel', 'admin', 'personnel administratif'].includes(role)) {
            expectedTotal++;
          }
        });

        setUserDistribution([
          { name: 'Élèves', value: eCount, color: COLORS[1] },
          { name: 'Enseignants', value: pCount, color: COLORS[0] },
          { name: 'Parents', value: parCount, color: COLORS[2] },
          { name: 'Administration', value: sCount, color: COLORS[3] }
        ]);

        const totalStudents = userSnapshot.docs.filter(d => ['élève', 'eleve'].includes(d.data().role?.toLowerCase())).length;

        // Calculate class redistribution indicators
        const cData = Object.entries(countsByClass).map(([name, students]) => ({
          name,
          students,
          percentage: totalStudents > 0 ? Number(((students / totalStudents) * 100).toFixed(1)) : 0
        })).sort((a, b) => b.students - a.students).slice(0, 8);
        setClassData(cData);

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
      return () => { unsubEco(); unsubWellbeing(); unsubHouses(); unsubDashboard(); unsubWeeklyAtt(); };
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
          <p className="text-sm text-gray-500 mt-1">
            {currentUser?.role === 'enseignant' 
              ? `${t('teacher_greeting')} ${currentUser?.prenom || ''} ${currentUser?.nom || ''}`
              : currentUser?.role === 'élève'
              ? `${t('student_greeting')} ${currentUser?.prenom || ''} ${currentUser?.nom || ''}`
              : `Bonjour ${currentUser?.prenom || 'Utilisateur'}, ravi de vous revoir !`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <LiveClock showDate={true} showTime={false} />
          </div>
          {onNavigate && (
            <button 
              onClick={() => onNavigate('settings')}
              className="p-2.5 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
              title={t('settings')}
            >
              <SettingsIcon size={20} />
            </button>
          )}
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
