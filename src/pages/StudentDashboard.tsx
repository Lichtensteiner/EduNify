import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { collection, query, where, getDocs, onSnapshot, updateDoc, doc, getDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  LogOut, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Bell, 
  X, 
  Info, 
  Castle, 
  Trash2, 
  AlertTriangle, 
  CheckCircle,
  Activity,
  TrendingUp,
  Award,
  BookOpen,
  Settings,
  Sparkles,
  Image as ImageIcon,
  FileText
} from 'lucide-react';
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
import { motion, AnimatePresence } from 'motion/react';
import LiveClock from '../components/LiveClock';
import NewUserAnnouncement from '../components/NewUserAnnouncement';

interface Notification {
  id: string;
  title?: string;
  message: string;
  read?: boolean;
  timestamp: string;
  type?: 'info' | 'warning' | 'success';
}

export default function StudentDashboard({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { t } = useLanguage();
  const { currentUser, logout } = useAuth();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedNotificationState, setSelectedNotificationState] = useState<Notification | null>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [house, setHouse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');

  // Restore Missing Notification State Handling
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.modal === 'notification') {
        // Modal is open
      } else {
        setSelectedNotificationState(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const selectedNotification = selectedNotificationState;
  const setSelectedNotification = (notif: Notification | null) => {
    setSelectedNotificationState(notif);
    if (notif) {
      window.history.pushState({ modal: 'notification' }, '');
    } else {
      if (window.history.state?.modal === 'notification') {
        window.history.back();
      }
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    // Fetch grades
    const gradesQuery = query(collection(db, 'grades'), where('studentId', '==', currentUser.id));
    const unsubscribeGrades = onSnapshot(gradesQuery, (snapshot) => {
      const gradesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGrades(gradesData);
    });

    // Fetch homework
    const hwQuery = currentUser.classe 
      ? query(collection(db, 'homework'), where('classId', '==', currentUser.classe))
      : query(collection(db, 'homework'));
    
    const unsubscribeHw = onSnapshot(hwQuery, (snapshot) => {
      setHomework(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch live courses (resources)
    // We use the 'resources' collection because it contains the courses officially published to the student's class
    const coursesQuery = currentUser.classe 
      ? query(collection(db, 'resources'), where('class_name', '==', currentUser.classe))
      : query(collection(db, 'resources'), orderBy('timestamp', 'desc'), limit(10));

    const unsubscribeCourses = onSnapshot(coursesQuery, (snapshot) => {
      const coursesData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data()
      }));
      
      // Sort client-side
      coursesData.sort((a: any, b: any) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });

      setCourses(coursesData);
    });

    return () => {
      unsubscribeGrades();
      unsubscribeHw();
      unsubscribeCourses();
    };
  }, [currentUser]);

  // Analytics Helpers
  const calculateAverage = (gradeList: any[]) => {
    if (!gradeList || gradeList.length === 0) return 0;
    const validGrades = gradeList.filter(g => g.maxScore > 0);
    if (validGrades.length === 0) return 0;
    
    const totalWeightedScore = validGrades.reduce((acc, g) => acc + (g.score / g.maxScore * 20) * (g.coefficient || 1), 0);
    const totalCoefficients = validGrades.reduce((acc, g) => acc + (g.coefficient || 1), 0);
    
    if (totalCoefficients === 0) return 0;
    const avg = totalWeightedScore / totalCoefficients;
    return isNaN(avg) ? 0 : avg;
  };

  const getAnalyticsData = () => {
    // 1. Evolution Data
    const evolutionData = grades
      .filter(g => g.maxScore > 0)
      .map(g => ({
        date: g.date?.toDate ? g.date.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : 'N/A',
        timestamp: g.date?.toDate ? g.date.toDate().getTime() : 0,
        score: parseFloat(((g.score / g.maxScore) * 20).toFixed(2)) || 0,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    // 2. Homework Data
    const completedCount = homework.filter(h => h.completedBy?.includes(currentUser?.id)).length;
    const totalHw = homework.length || 1; // Avoid divide by zero
    const pendingCount = Math.max(0, homework.length - completedCount);
    const hwData = [
      { name: 'Terminés', value: completedCount, color: '#10b981' },
      { name: 'À faire', value: pendingCount, color: '#6366f1' }
    ];

    // 3. Subject Data
    const subjectAverages = Array.from(new Set(grades.filter(g => g && g.subject).map(g => g.subject))).map(subject => {
      const sGrades = grades.filter(g => g.subject === subject);
      return {
        subject,
        average: calculateAverage(sGrades),
        interrogations: sGrades.filter(g => g.type === 'interrogation').length,
        evaluations: sGrades.filter(g => g.type === 'evaluation').length
      };
    }).sort((a, b) => (b.average || 0) - (a.average || 0));

    // 3. Attendance Stats
    const attendanceStats = {
      presents: attendance.filter(a => a.statut === 'Présent').length,
      absents: attendance.filter(a => a.statut === 'Absent').length,
      retards: attendance.filter(a => a.statut === 'Retard').length,
      total: attendance.length || 1
    };

    return { evolutionData, hwData, subjectAverages, attendanceStats };
  };

  const { evolutionData, hwData, subjectAverages, attendanceStats } = getAnalyticsData();
  
  const subjects = ['all', ...Array.from(new Set(courses.map(c => c.subject).filter(Boolean)))];
  const filteredCourses = selectedSubjectFilter === 'all' 
    ? courses 
    : courses.filter(c => c.subject === selectedSubjectFilter);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      try {
        const attQuery = query(collection(db, 'attendance'), where('user_id', '==', currentUser.id));
        const attSnap = await getDocs(attQuery);
        const attData = attSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        attData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setAttendance(attData);

        if (currentUser.house_id) {
          const houseDoc = await getDoc(doc(db, 'houses', currentUser.house_id));
          if (houseDoc.exists()) {
            setHouse({ id: houseDoc.id, ...houseDoc.data() });
          }
        }
      } catch (err) {
        console.error("Erreur:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    if (!currentUser) return;
    const notifQuery = query(collection(db, 'notifications'), where('user_id', '==', currentUser.id));
    const unsubscribeNotifs = onSnapshot(notifQuery, (snap) => {
      const notifData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      notifData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setNotifications(notifData);
    });

    return () => unsubscribeNotifs();
  }, [currentUser]);

  const handleNotificationClick = async (notif: Notification) => {
    setSelectedNotification(notif);
    if (!notif.read) {
      try {
        await updateDoc(doc(db, 'notifications', notif.id), { read: true });
      } catch (error) {
        console.error("Erreur lors de la mise à jour de la notification:", error);
      }
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
      setSelectedNotification(null);
    } catch (error) {
      console.error("Erreur lors de la suppression de la notification:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
          <NewUserAnnouncement />
          <LiveClock className="items-center sm:items-end" showDate={true} />
        </div>
        
        {/* Responsive Student Information Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-150 p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto text-center sm:text-left">
            {currentUser?.photo ? (
              <img 
                src={currentUser.photo} 
                alt="Profile" 
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 border-indigo-50 shrink-0" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xl sm:text-2xl font-black uppercase shrink-0">
                {currentUser?.prenom?.[0] || currentUser?.email?.[0] || 'U'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight break-all line-clamp-2">
                {t('student_greeting')} {currentUser?.prenom || currentUser?.nom ? `${currentUser?.prenom || ''} ${currentUser?.nom || ''}`.trim() : currentUser?.email?.split('@')[0] || 'Utilisateur'}
              </h1>
              <p className="text-sm text-gray-500 mt-1 capitalize font-semibold tracking-wide flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span>{currentUser?.role}</span>
                {currentUser?.classe && (
                  <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                    {currentUser.classe}
                  </span>
                )}
              </p>
              {house && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border" style={{ backgroundColor: `${house.color}15`, color: house.color, borderColor: `${house.color}30` }}>
                  {house.logo.startsWith('http') ? (
                    <img src={house.logo} alt={house.nom_maison} className="w-3.5 h-3.5 object-cover rounded-full shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="shrink-0">{house.logo}</span>
                  )}
                  <span className="truncate">{house.nom_maison} ({house.total_points} pts)</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Real-time statistics block replacing the old logout/settings buttons */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 shrink-0 w-full sm:w-auto justify-center sm:justify-end border-t border-gray-100 sm:border-0 pt-4 sm:pt-0">
            {/* Real-time Metric 1: Pending Homework */}
            <div className="flex items-center gap-2 sm:gap-2.5 bg-indigo-50/60 px-3.5 py-2 rounded-2xl border border-indigo-100/50 flex-1 sm:flex-initial min-w-[90px] justify-center sm:justify-start">
              <BookOpen size={16} className="text-indigo-600 shrink-0" />
              <div className="text-center sm:text-left min-w-0">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-500 leading-none">Devoirs</p>
                <p className="text-xs sm:text-sm font-black text-indigo-900 mt-1 truncate">
                  {homework.filter(h => !h.completedBy?.includes(currentUser?.id)).length} rests
                </p>
              </div>
            </div>

            {/* Real-time Metric 2: Live Average Grade */}
            <div className="flex items-center gap-2 sm:gap-2.5 bg-emerald-50/60 px-3.5 py-2 rounded-2xl border border-emerald-100/50 flex-1 sm:flex-initial min-w-[90px] justify-center sm:justify-start">
              <Award size={16} className="text-emerald-600 shrink-0" />
              <div className="text-center sm:text-left min-w-0">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-500 leading-none">Moyenne</p>
                <p className="text-xs sm:text-sm font-black text-emerald-950 mt-1 truncate">
                  {calculateAverage(grades).toFixed(1)}/20
                </p>
              </div>
            </div>

            {/* Real-time Metric 3: Live Attendance Rate */}
            <div className="flex items-center gap-2 sm:gap-2.5 bg-amber-50/60 px-3.5 py-2 rounded-2xl border border-amber-100/50 flex-1 sm:flex-initial min-w-[90px] justify-center sm:justify-start">
              <Clock size={16} className="text-amber-600 shrink-0" />
              <div className="text-center sm:text-left min-w-0">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-amber-500 leading-none">Présence</p>
                <p className="text-xs sm:text-sm font-black text-amber-900 mt-1 truncate">
                  {attendanceStats.total > 0 && attendanceStats.presents !== undefined
                    ? `${((attendanceStats.presents / attendanceStats.total) * 100).toFixed(0)}%`
                    : "100%"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Grade Evolution Chart */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-gray-100"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 flex items-center gap-2">
                  <Activity size={20} className="text-indigo-600 shrink-0" />
                  <span>Progression de mes notes</span>
                </h2>
                <p className="text-xs text-gray-500 font-medium">Moyenne sur 20 évolutive</p>
              </div>
              <div className="bg-indigo-50/50 px-4 py-2 rounded-2xl border border-indigo-100/40 text-left sm:text-right shrink-0 w-full sm:w-auto flex sm:block justify-between items-center">
                <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Moyenne Générale</p>
                <span className="text-xl sm:text-2xl font-black text-indigo-600">{calculateAverage(grades).toFixed(2)}</span>
              </div>
            </div>

            <div className="h-[260px] sm:h-[300px] w-full">
              {evolutionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolutionData}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      dy={10}
                    />
                    <YAxis 
                      domain={[0, 20]} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'white' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="score" 
                      name="Moyenne"
                      stroke="#6366f1" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorScore)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 border-2 border-dashed border-gray-100 rounded-2xl">
                  <TrendingUp size={48} className="opacity-20" />
                  <p className="text-sm font-medium">En attente de vos premières évaluations</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Quick Access Sidebar */}
          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-gray-100"
            >
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                Sérieux aux devoirs
              </h2>
              <div className="h-[100px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hwData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" hide />
                    <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={25}>
                      {hwData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between mt-4">
                {hwData.map((d, i) => (
                  <div key={i} className="text-center">
                    <div className="text-xl font-black" style={{ color: d.color }}>{d.value}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{d.name}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-gray-100"
            >
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Award size={16} className="text-amber-500 shrink-0" />
                Moyennes par Matière
              </h2>
              <div className="space-y-4 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar border-b border-gray-50 pb-6">
                {subjectAverages.length > 0 ? subjectAverages.map((sub, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-gray-700 truncate max-w-[70%]">{sub.subject}</span>
                      <span className={`font-black shrink-0 ${sub.average >= 12 ? 'text-green-600' : 'text-amber-600'}`}>{sub.average.toFixed(2)}/20</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(sub.average / 20) * 100}%` }}
                        className={`h-full rounded-full ${sub.average >= 12 ? 'bg-green-500' : 'bg-amber-500'}`}
                        transition={{ duration: 1, delay: i * 0.1 }}
                      />
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-xs text-gray-400 py-4 italic">En attente de notation</p>
                )}
              </div>

              {/* Real-time Density indicator */}
              <div className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Activity size={12} className="text-emerald-500" />
                      Densité de Présence
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-gray-900">{attendanceStats.total > 0 ? Math.round((attendanceStats.presents / attendanceStats.total) * 100) : 0}%</span>
                  </div>
                </div>
                <div className="h-2.5 w-full bg-gray-50 rounded-full border border-gray-100 p-0.5 shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${attendanceStats.total > 0 ? (attendanceStats.presents / attendanceStats.total) * 100 : 0}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.2)_50%,rgba(255,255,255,.2)_75%,transparent_75%,transparent)] bg-[length:15px_15px] animate-[slide_1s_linear_infinite]" />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Assessment Volume Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-gray-100"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 flex items-center gap-2">
                <BookOpen size={20} className="text-indigo-600 shrink-0" />
                Volume d'évaluations par matière
              </h2>
              <p className="text-xs text-gray-500">Nombre d'interrogations et d'évaluations rattachées</p>
            </div>
            <div className="flex flex-wrap gap-2.5 mt-1 sm:mt-0">
              <div className="flex items-center gap-1.5 bg-indigo-50/75 px-3 py-1 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Interrogations</span>
              </div>
              <div className="flex items-center gap-1.5 bg-teal-50/75 px-3 py-1 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Évaluations</span>
              </div>
            </div>
          </div>

          <div className="h-[260px] sm:h-[300px] w-full">
            {subjectAverages.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectAverages} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="subject" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fill: '#9ca3af', fontWeight: 'bold' }}
                    interval={0}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="interrogations" name="Interrogations" fill="#6366f1" stackId="a" radius={[0, 0, 0, 0]} barSize={28} />
                  <Bar dataKey="evaluations" name="Evaluations" fill="#14b8a6" stackId="a" radius={[10, 10, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 border-2 border-dashed border-gray-100 rounded-2xl">
                <BookOpen size={48} className="opacity-20" />
                <p className="text-sm font-medium">Aucune donnée d'évaluation disponible</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Attendance & Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Mon historique de présence</h2>
            
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              {loading ? (
                <div className="p-12 flex justify-center">
                  <RefreshCw className="animate-spin text-indigo-600" size={32} />
                </div>
              ) : attendance.length === 0 ? (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center gap-2">
                  <AlertCircle size={32} className="text-gray-300" />
                  <p>Aucun pointage enregistré pour le moment.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {attendance.map(record => (
                    <div key={record.id} className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 sm:gap-4 flex-1">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 ${
                          record.statut === 'Présent' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          <CheckCircle2 size={20} className="sm:size-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-gray-900 text-sm sm:text-base capitalize break-words pr-2">
                            {new Date(record.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] sm:text-xs text-gray-500 mt-1 uppercase font-semibold">
                            <Clock size={12} className="shrink-0 text-indigo-500" />
                            <span>Arrivée : <span className="font-mono font-bold text-gray-700">{record.heure_arrivee}</span></span>
                          </div>
                        </div>
                      </div>
                      <div className="flex sm:justify-end shrink-0">
                        <span className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-black border uppercase tracking-wider text-center w-full sm:w-auto ${
                          record.statut === 'Présent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {record.statut}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Bell size={20} className="text-indigo-600" />
              Notifications
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {loading ? (
                <div className="p-8 flex justify-center">
                  <RefreshCw className="animate-spin text-indigo-600" size={24} />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center gap-2">
                  <Bell size={24} className="text-gray-300" />
                  <p className="text-sm">Aucune notification.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                  {notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${notif.read ? 'bg-white' : 'bg-indigo-50/30'}`}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${notif.read ? 'bg-transparent' : 'bg-indigo-500'}`}></div>
                        <div className="flex-1">
                          {notif.title && <p className={`text-sm ${notif.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>{notif.title}</p>}
                          <p className={`text-sm line-clamp-2 ${notif.read ? 'text-gray-500' : 'text-gray-800'}`}>{notif.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notif.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notification Details Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up sm:animate-fade-in">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedNotification.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                  selectedNotification.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {selectedNotification.type === 'warning' ? <AlertTriangle size={20} /> :
                   selectedNotification.type === 'success' ? <CheckCircle size={20} /> :
                   <Info size={20} />}
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  {selectedNotification.title || 'Notification'}
                </h3>
              </div>
              <button onClick={() => setSelectedNotification(null)} className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-100 p-2 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-base">{selectedNotification.message}</p>
              <p className="text-sm text-gray-400 mt-6 flex items-center gap-1.5">
                <Clock size={14} />
                {new Date(selectedNotification.timestamp).toLocaleString(undefined, {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </p>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <button 
                onClick={() => deleteNotification(selectedNotification.id)}
                className="px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl font-medium text-sm transition-colors flex items-center gap-2"
              >
                <Trash2 size={18} />
                Supprimer
              </button>
              <button 
                onClick={() => setSelectedNotification(null)}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium text-sm transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
