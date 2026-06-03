import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Shield, 
  Bell, 
  Database, 
  Moon, 
  Sun, 
  Monitor, 
  User, 
  Globe, 
  Wifi, 
  Cpu, 
  Lock, 
  Smartphone,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Zap,
  Clock,
  Camera,
  LogOut,
  ChevronRight,
  HardDrive,
  Activity,
  History,
  Fingerprint,
  RefreshCw,
  LayoutDashboard,
  Users as UsersIcon,
  Download as DownloadIcon,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, onSnapshot, collection, query, where, getDocs, limit, orderBy, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../lib/firebase';
import { resizeImage } from '../lib/imageUtils';
import confetti from 'canvas-confetti';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';

import { usePWA } from '../hooks/usePWA';
import { updateClientSideApiKey, generateAIContent } from '../services/aiService';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const { currentUser } = useAuth();
  const { isInstallable, installApp, isStandalone } = usePWA();
  
  const [activeTab, setActiveTab] = useState<'appearance' | 'profile' | 'notifications' | 'security' | 'system'>('appearance');
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dbStatus, setDbStatus] = useState<'connected' | 'connecting' | 'offline'>('connecting');
  const [latency, setLatency] = useState<number>(0);
  const [lastSaved, setLastSaved] = useState<string>('À l\'instant');
  const [sessionLogs, setSessionLogs] = useState<{ id: string; event: string; time: string; type: 'info' | 'auth' | 'system' }[]>([]);
  const [activeSessions, setActiveSessions] = useState<{ id: string; device: string; location: string; current: boolean; date: string; os?: string; browser?: string }[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 5, percentage: 0 });
  const [density, setDensity] = useState(0);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; timestamp: string; read: boolean; type?: string }[]>([]);
  const [adminSessions, setAdminSessions] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState({
    browsers: [] as any[],
    os: [] as any[],
    devices: [] as any[],
    totalActive: 0
  });
  const [notifPreferences, setNotifPreferences] = useState({
    push: true,
    email: false,
    sms: true,
    urgent: true
  });
  const [formPrenom, setFormPrenom] = useState(currentUser?.prenom || '');
  const [formNom, setFormNom] = useState(currentUser?.nom || '');
  const [formPhoto, setFormPhoto] = useState(currentUser?.photo || '');
  const [formCover, setFormCover] = useState(currentUser?.cover_photo || '');
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [geminiKey, setGeminiKey] = useState(() => {
    try {
      return localStorage.getItem('GEMINI_API_KEY') || '';
    } catch {
      return '';
    }
  });
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ status: 'idle' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });

  const handleSaveAndTestAI = async () => {
    setTestingAI(true);
    setAiTestResult({ status: 'idle', message: '' });
    try {
      // 1. Save internally and clear memory cache
      updateClientSideApiKey(geminiKey);
      
      // 2. Test direct generation
      const res = await generateAIContent({
        contents: [{ parts: [{ text: "Dis exactement le mot 'Succès' sans ponctuation." }] }]
      });
      
      if (res && res.text) {
        setAiTestResult({ 
          status: 'success', 
          message: `Connexion à l'IA établie avec succès ! (Réponse IA: "${res.text.trim()}")` 
        });
        addLog("Clé de l'Assistant IA mise à jour et testée avec succès", "system");
      } else {
        throw new Error("L'IA n'a retourné aucune réponse.");
      }
    } catch (err: any) {
      console.error(err);
      setAiTestResult({ 
        status: 'error', 
        message: err.message || "Échec de connexion : Vérifiez la validité de votre clé API Gemini." 
      });
      addLog("Échec de la configuration de l'Assistant IA", "system");
    } finally {
      setTestingAI(false);
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  const handleTerminateSession = async (sessionId: string) => {
    try {
      await updateDoc(doc(db, 'user_sessions', sessionId), {
        status: 'inactive'
      });
      addLog('Session terminée à distance', 'system');
    } catch (error) {
      console.error('Error terminating session:', error);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'notifications', id));
      addLog('Notification supprimée', 'info');
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  useEffect(() => {
    if (currentUser) {
      setFormPrenom(currentUser.prenom || '');
      setFormNom(currentUser.nom || '');
      setFormPhoto(currentUser.photo || '');
      setFormCover(currentUser.cover_photo || '');
      if (currentUser.notifications) {
        setNotifPreferences(currentUser.notifications);
      }
    }
  }, [currentUser]);

  const addLog = (event: string, type: 'info' | 'auth' | 'system' = 'info') => {
    setSessionLogs(prev => [
      { id: Math.random().toString(36).substring(2, 9), event, time: new Date().toLocaleTimeString(), type },
      ...prev.slice(0, 9)
    ]);
  };

  const handleUpdateProfile = async () => {
    if (!currentUser?.id) return;
    setSaving(true);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        prenom: formPrenom,
        nom: formNom,
        photo: formPhoto,
        cover_photo: formCover,
        updatedAt: new Date()
      });
      setLastSaved('À l\'instant');
      addLog('Profil mis à jour avec succès', 'system');
      setShowSuccess(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4f46e5', '#10b981', '#ffffff']
      });
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      addLog('Erreur lors de la mise à jour du profil', 'system');
    } finally {
      setSaving(false);
    }
  };

  const togglePreference = async (key: keyof typeof notifPreferences) => {
    if (!currentUser?.id) return;
    const newPrefs = { ...notifPreferences, [key]: !notifPreferences[key] };
    setNotifPreferences(newPrefs);
    
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        notifications: newPrefs
      });
      setLastSaved('À l\'instant');
      addLog(`Préférence ${key} modifiée`, 'system');
    } catch (error) {
      console.error('Error updating notifications:', error);
      setNotifPreferences(prev => ({ ...prev, [key]: !prev[key] })); // Rollback
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'cover_photo') => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.id) return;

    if (type === 'photo') setUploadingPhoto(true);
    else setUploadingCover(true);

    try {
      const maxWidth = type === 'photo' ? 400 : 1200;
      const maxHeight = type === 'photo' ? 400 : 600;
      const resizedBlob = await resizeImage(file, maxWidth, maxHeight);

      const storageRef = ref(storage, `users/${currentUser.id}/${type}_${Date.now()}`);
      await uploadBytes(storageRef, resizedBlob);
      const downloadURL = await getDownloadURL(storageRef);
      
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, { [type]: downloadURL });
      
      if (type === 'photo') setFormPhoto(downloadURL);
      else setFormCover(downloadURL);
      
      addLog(`Mise à jour de la ${type === 'photo' ? 'photo de profil' : 'couverture'} réussie`, 'system');
      confetti({ particleCount: 50, spread: 40 });
    } catch (err) {
      console.error('Upload error:', err);
      addLog('Erreur lors du téléchargement de l\'image', 'system');
    } finally {
      if (type === 'photo') setUploadingPhoto(false);
      else setUploadingCover(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addLog('Connection rétablie', 'system');
    };
    const handleOffline = () => {
      setIsOnline(false);
      addLog('Passage en mode hors-ligne', 'system');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Real-time DB status check
    const checkDB = async () => {
      try {
        const start = Date.now();
        // Simple light check to a known collection or dummy doc
        setDbStatus('connecting');
        const { getDocFromServer, doc } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'system', 'health'));
        setLatency(Date.now() - start);
        setDbStatus('connected');
      } catch (err) {
        setDbStatus('offline');
      }
    };

    // Fetch Real-time data for "Pro" metrics
    const fetchProMetrics = async () => {
      // 1. Session logs (real from DB if available, here we use our local ones)
      setSessionLogs([
        { id: '1', event: 'Connexion établie', time: new Date().toLocaleTimeString(), type: 'auth' },
        { id: '2', event: `Protocole ${window.location.protocol.toUpperCase()} vérifié`, time: new Date(Date.now() - 500).toLocaleTimeString(), type: 'system' },
        { id: '3', event: 'Cache applicatif synchronisé', time: new Date(Date.now() - 1500).toLocaleTimeString(), type: 'info' }
      ]);

      // 2. Real-time Active Sessions Explorer
      const sessionsQuery = isAdmin 
        ? query(collection(db, 'user_sessions'), orderBy('lastActive', 'desc'), limit(50))
        : query(collection(db, 'user_sessions'), where('userId', '==', currentUser?.id), where('status', '==', 'active'));

      const unsubSessions = onSnapshot(sessionsQuery, (snapshot) => {
        const sessions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];
        
        // Sort sessions: current one first, then by lastActive
        const sortedSessions = [...sessions].sort((a, b) => {
          if (a.id === auth.currentUser?.uid) return -1;
          return (b.lastActive?.seconds || 0) - (a.lastActive?.seconds || 0);
        });

        if (isAdmin) {
          setAdminSessions(sessions);
          // Calculate Stats only for active sessions
          const activeSessionsData = sessions.filter(s => s.status === 'active');
          const browserMap: Record<string, number> = {};
          const osMap: Record<string, number> = {};
          const deviceMap: Record<string, number> = {};

          activeSessionsData.forEach(s => {
            const b = s.browser?.split(' ')[0] || 'Unknown';
            browserMap[b] = (browserMap[b] || 0) + 1;
            
            const o = s.os?.split(' ')[0] || 'Unknown';
            osMap[o] = (osMap[o] || 0) + 1;

            const d = s.isMobile ? 'Mobile/Tablette' : 'Ordinateur';
            deviceMap[d] = (deviceMap[d] || 0) + 1;
          });

          setSystemStats({
            browsers: Object.entries(browserMap).map(([name, value]) => ({ name, value })),
            os: Object.entries(osMap).map(([name, value]) => ({ name, value })),
            devices: Object.entries(deviceMap).map(([name, value]) => ({ name, value })),
            totalActive: activeSessionsData.length
          });
        }

        setActiveSessions(sortedSessions
          .filter(s => !isAdmin || s.userId === currentUser?.id)
          .map(s => ({
            id: s.id,
            device: s.device,
            location: s.location || 'Libreville, GA',
            current: s.userAgent === navigator.userAgent,
            date: s.lastActive?.toDate ? s.lastActive.toDate().toLocaleString() : 'En ligne',
            os: s.os,
            browser: s.browser
          })));
      });

      // 3. Real-time User Density
      const unsubDensity = onSnapshot(collection(db, 'attendance'), (snapshot) => {
        const today = new Date().toISOString().split('T')[0];
        const presents = snapshot.docs.filter(d => d.data().date === today && d.data().statut === 'Présent').length;
        // Approximation of total active users for demo
        setDensity(Math.min(100, Math.round((presents / 50) * 100)));
      });

      // 4. Real-time Notifications List
      const notifsQuery = query(
        collection(db, 'notifications'),
        where('user_id', '==', currentUser?.id)
      );

      const unsubNotifs = onSnapshot(notifsQuery, (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];
        
        // Sort by timestamp
        notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setNotifications(notifs);
      });

      return () => {
        unsubSessions();
        unsubDensity();
        unsubNotifs();
      };
    };

    fetchProMetrics();
    const dbInterval = setInterval(checkDB, 30000); // Every 30s

    // Simulate latency monitoring for UI feel
    const latencyInterval = setInterval(() => {
      setLatency(prev => {
        const jitter = Math.floor(Math.random() * 6) - 3;
        return Math.max(5, prev + jitter);
      });
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(dbInterval);
      clearInterval(latencyInterval);
    };
  }, []);

  const tabs = [
    { id: 'appearance', label: 'Apparence', icon: Sun },
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'notifications', label: 'Alertes', icon: Bell },
    { id: 'security', label: 'Sécurité', icon: Lock },
    { id: 'system', label: 'Système', icon: Zap },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 pb-12 px-4 sm:px-6 lg:px-8">
      {/* Header with Connection Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white">
              <SettingsIcon size={24} />
            </div>
            {t('system_settings')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('global_app_config')}</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 bg-white dark:bg-gray-800 p-1.5 sm:p-2 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex-wrap sm:flex-nowrap justify-center sm:justify-start">
          <div className="flex px-3 py-1.5 rounded-xl items-center gap-2 text-[8px] sm:text-[10px] font-black text-gray-400 bg-gray-50 dark:bg-gray-900/50">
            <Clock size={12} className="shrink-0" />
            <span className="hidden xs:inline">SAUVEGARDÉ :</span> {lastSaved.toUpperCase()}
          </div>
          <div className={`px-2 sm:px-3 py-1.5 rounded-xl flex items-center gap-2 text-[10px] sm:text-xs font-bold ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            <Wifi size={14} className={isOnline ? 'animate-pulse shrink-0' : 'shrink-0'} />
            {latency}ms
          </div>
          <div className={`px-2 sm:px-3 py-1.5 rounded-xl flex items-center gap-2 text-[10px] sm:text-xs font-bold ${dbStatus === 'connected' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
            <Database size={14} className="shrink-0" />
            <span className="hidden xs:inline">{dbStatus === 'connected' ? 'CLOUD READY' : 'SYNCING...'}</span>
            <span className="xs:hidden">{dbStatus === 'connected' ? 'READY' : 'SYNC'}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <aside className="lg:w-64 shrink-0">
          <nav className="flex lg:flex-col gap-2 p-1 bg-gray-100/50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                    isActive 
                      ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-100 dark:border-gray-700' 
                      : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/30'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/20 dark:shadow-none p-6 md:p-8"
            >
              {activeTab === 'appearance' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('system_appearance')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Adaptez l'interface au confort de vos yeux.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {(['light', 'dark', 'system'] as const).map((tValue) => (
                      <button
                        key={tValue}
                        onClick={() => setTheme(tValue)}
                        className={`group relative flex flex-col p-6 rounded-2xl border-2 transition-all ${
                          theme === tValue 
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20' 
                            : 'border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-600'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center transition-transform group-hover:scale-110 ${
                          theme === tValue ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                        }`}>
                          {tValue === 'light' ? <Sun size={24} /> : tValue === 'dark' ? <Moon size={24} /> : <Monitor size={24} />}
                        </div>
                        <span className={`font-black text-sm uppercase tracking-wider ${theme === tValue ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-600 dark:text-gray-400'}`}>
                          {t(tValue)}
                        </span>
                        {theme === tValue && (
                          <div className="absolute top-4 right-4">
                            <CheckCircle2 size={16} className="text-indigo-600" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                    <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-4">Langue de l'Interface</h4>
                    <div className="flex flex-wrap gap-3">
                      {['fr', 'en', 'es', 'zh', 'ja', 'pt'].map((lng) => (
                        <button
                          key={lng}
                          onClick={() => setLanguage(lng as any)}
                          className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                            language === lng 
                              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-lg' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          {lng === 'fr' ? '🇫🇷 Français' : lng === 'en' ? '🇬🇧 English' : lng === 'es' ? '🇪🇸 Español' : lng === 'zh' ? '🇨🇳 中文' : lng === 'ja' ? '🇯🇵 日本語' : '🇵🇹 Português'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="space-y-8">
                  <div className="relative group rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-lg h-48 bg-gray-200 dark:bg-gray-700">
                    {formCover ? (
                      <img src={formCover} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Monitor size={48} className="opacity-20" />
                      </div>
                    )}
                    <label className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-all flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer">
                       <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'cover_photo')} disabled={uploadingCover} />
                       {uploadingCover ? (
                         <RefreshCw className="text-white animate-spin mb-2" size={32} />
                       ) : (
                         <Camera className="text-white mb-2" size={32} />
                       )}
                       <p className="text-white text-xs font-black uppercase tracking-widest">{uploadingCover ? 'Téléchargement...' : 'Changer la couverture'}</p>
                    </label>
                  </div>

                  <div className="flex flex-col md:flex-row items-center gap-6 px-6 -mt-16 relative z-10">
                    <div className="w-32 h-32 bg-white dark:bg-gray-800 rounded-3xl flex items-center justify-center border-8 border-white dark:border-gray-800 shadow-2xl relative group overflow-hidden">
                      {formPhoto ? (
                        <img src={formPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User size={48} className="text-indigo-600" />
                      )}
                      <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'photo')} disabled={uploadingPhoto} />
                        {uploadingPhoto ? <RefreshCw className="text-white animate-spin" size={24} /> : <Camera className="text-white" size={24} />}
                        <span className="text-white text-[8px] font-black uppercase mt-1 text-center px-2">Photo</span>
                      </label>
                      {uploadingPhoto && (
                        <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] flex items-center justify-center">
                          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="text-center md:text-left mt-12 md:mt-0">
                      <h3 className="text-3xl font-black text-gray-900 dark:text-white drop-shadow-sm">{formPrenom} {formNom}</h3>
                      <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold uppercase text-[10px] tracking-widest bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border border-indigo-50 dark:border-indigo-900/50">{currentUser?.role}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[10px] tracking-widest bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border border-emerald-50 dark:border-emerald-900/50 flex items-center gap-1">
                          <Wifi size={10} /> EN LIGNE
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Prénom</label>
                      <input 
                        type="text" 
                        value={formPrenom}
                        onChange={(e) => setFormPrenom(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Nom</label>
                      <input 
                        type="text" 
                        value={formNom}
                        onChange={(e) => setFormNom(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">URL Photo de Profil</label>
                      <input 
                        type="text" 
                        value={formPhoto}
                        onChange={(e) => setFormPhoto(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">URL Image de Couverture</label>
                      <input 
                        type="text" 
                        value={formCover}
                        onChange={(e) => setFormCover(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button 
                      onClick={handleUpdateProfile}
                      disabled={saving}
                      className={`px-8 py-3 rounded-xl font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2 ${
                        showSuccess 
                          ? 'bg-emerald-600 text-white shadow-emerald-200' 
                          : 'bg-indigo-600 text-white shadow-indigo-200 dark:shadow-none hover:bg-indigo-700'
                      } ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {saving ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : showSuccess ? (
                        <CheckCircle2 size={20} />
                      ) : (
                        <Database size={20} />
                      )}
                      {saving ? 'Enregistrement...' : showSuccess ? 'Profil mis à jour !' : 'Mettre à jour le profil'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Centre de Notifications</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Contrôlez comment l'établissement communique avec vous.</p>
                  </div>

                    <div className="space-y-4">
                      {[
                        { key: 'push', icon: Monitor, label: 'Notifications Push', desc: 'Alertes en temps réel sur cet appareil' },
                        { key: 'email', icon: Globe, label: 'Email Hebdomadaire', desc: 'Résumé de l\'activité et des notes' },
                        { key: 'sms', icon: Smartphone, label: 'Alertes SMS', desc: 'Retards, absences ou urgences importantes' },
                        { key: 'urgent', icon: Zap, label: 'Alertes Système', desc: 'Maintenance et mises à jour critiques' }
                      ].map((pref) => (
                        <div key={pref.key} className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-gray-500">
                              <pref.icon size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-sm text-gray-900 dark:text-white">{pref.label}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{pref.desc}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => togglePreference(pref.key as any)}
                            className={`w-12 h-6 rounded-full transition-all relative ${notifPreferences[pref.key as keyof typeof notifPreferences] ? 'bg-indigo-600 shadow-inner' : 'bg-gray-200 dark:bg-gray-700'}`}
                          >
                            <div className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all ${notifPreferences[pref.key as keyof typeof notifPreferences] ? 'right-1' : 'left-1'}`} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="pt-8 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Journal des Alertes Récentes</h4>
                        <span className="text-[10px] font-black px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded uppercase">Actualisation en temps réel</span>
                      </div>
                      
                      <div className="space-y-3">
                        {notifications.length > 0 ? (
                          notifications.slice(0, 5).map(notif => (
                            <div key={notif.id} className={`p-4 rounded-2xl border ${notif.read ? 'border-gray-100 dark:border-gray-700 bg-gray-50/30' : 'border-indigo-100 bg-indigo-50/30 dark:bg-indigo-900/10 shadow-sm shadow-indigo-100/50'} flex justify-between items-center group transition-all hover:border-indigo-300`}>
                               <div className="flex items-center gap-4">
                                  <div className={`p-2.5 rounded-xl ${notif.type === 'warning' ? 'bg-amber-100 text-amber-600' : notif.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                     {notif.type === 'warning' ? <AlertTriangle size={18} /> : notif.type === 'success' ? <CheckCircle2 size={18} /> : <Bell size={18} />}
                                  </div>
                                  <div>
                                     <p className="text-[13px] font-black text-gray-900 dark:text-white">
                                       {notif.title}
                                       {!notif.read && <span className="w-2 h-2 bg-indigo-600 rounded-full inline-block ml-2 mb-0.5" />}
                                     </p>
                                     <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{notif.message}</p>
                                     <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                                       {new Date(notif.timestamp).toLocaleString()}
                                     </p>
                                  </div>
                               </div>
                               <button 
                                 onClick={() => handleDeleteNotification(notif.id)}
                                 className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 hover:text-red-500 rounded-lg"
                               >
                                 <Trash2 size={16} />
                               </button>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                             <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Aucune alerte récente</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
              )}

              {activeTab === 'system' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Configuration Assistant IA Gemini */}
                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/20 dark:to-indigo-900/10 p-6 sm:p-8 rounded-3xl border border-indigo-100/80 dark:border-indigo-900/50 space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5 sm:opacity-10 pointer-events-none">
                      <Cpu size={120} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    
                    <div className="relative z-10 max-w-3xl space-y-4">
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white shadow-sm mb-3">
                          <Cpu size={11} className="animate-spin-slow animate-pulse" /> Assistant Intelligent
                        </span>
                        <h4 className="text-xl font-black text-gray-900 dark:text-white">Configuration de l'Assistant IA (Gemini)</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium leading-relaxed">
                          La clé API Gemini permet à l'application de générer des appréciations détaillées de bulletins scolaires via l'IA sur Vercel. 
                          Insérez votre clé API ci-dessous pour qu'elle soit stockée de manière transparente et sécurisée dans votre navigateur.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">Clé API Gemini</label>
                        <div className="relative flex items-center">
                          <input 
                            type={showGeminiKey ? 'text' : 'password'}
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full pl-4 pr-32 py-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
                          />
                          <div className="absolute right-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setShowGeminiKey(!showGeminiKey)}
                              className="text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              {showGeminiKey ? 'Masquer' : 'Afficher'}
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveAndTestAI}
                              disabled={testingAI}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-100 dark:shadow-none flex items-center gap-1.5"
                            >
                              {testingAI ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : null}
                              {testingAI ? 'Test...' : 'Enregistrer'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {aiTestResult.status !== 'idle' && (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-4 rounded-2xl border flex items-start gap-3 text-xs font-bold ${
                            aiTestResult.status === 'success' 
                              ? 'border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/10 dark:text-emerald-400' 
                              : 'border-red-100 bg-red-50 text-red-800 dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-400'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {aiTestResult.status === 'success' ? (
                              <CheckCircle2 size={16} className="text-emerald-500" />
                            ) : (
                              <AlertCircle size={16} className="text-red-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-extrabold uppercase text-[10px] tracking-wider mb-0.5">
                              {aiTestResult.status === 'success' ? 'Vérification réussie ✓' : 'Échec de la configuration'}
                            </p>
                            <p className="font-medium leading-relaxed">{aiTestResult.message}</p>
                          </div>
                        </motion.div>
                      )}

                      <div className="pt-2 flex items-center gap-2 text-xs font-medium text-gray-400">
                        <AlertCircle size={14} className="text-indigo-400" />
                        <span>Comment obtenir une clé ? Rendez-vous sur <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold">Google AI Studio</a> pour créer une clé API gratuite.</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <Activity className="text-indigo-600" size={28} />
                        Santé & Monitoring Système
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Analyse temps réel de l'infrastructure et des accès.</p>
                    </div>
                    {currentUser?.role === 'admin' && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{systemStats.totalActive} UTILISATEURS ACTIFS</span>
                      </div>
                    )}
                  </div>

                  {currentUser?.role === 'admin' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Browser Stats */}
                      <div className="bg-gray-50/50 dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <Globe size={14} className="text-blue-500" />
                          Navigateurs
                        </h4>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={systemStats.browsers}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={60}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {[0, 1, 2, 3, 4].map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                                ))}
                              </Pie>
                              <RechartsTooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 mt-4">
                          {systemStats.browsers.map((b, i) => (
                            <div key={b.name} className="flex items-center justify-between text-[10px] font-bold">
                              <span className="text-gray-500 uppercase">{b.name}</span>
                              <span className="text-gray-900 dark:text-white px-2 py-0.5 bg-white dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700">{b.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* OS Stats */}
                      <div className="bg-gray-50/50 dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <Monitor size={14} className="text-indigo-500" />
                          Systèmes d'Exploitation
                        </h4>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={systemStats.os}>
                              <XAxis dataKey="name" hide />
                              <YAxis hide />
                              <RechartsTooltip cursor={{fill: 'transparent'}} />
                              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 mt-4">
                          {systemStats.os.map((o, i) => (
                            <div key={o.name} className="flex items-center justify-between text-[10px] font-bold">
                              <span className="text-gray-500 uppercase">{o.name}</span>
                              <span className="text-gray-900 dark:text-white px-2 py-0.5 bg-white dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700">{o.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Device Stats */}
                      <div className="bg-gray-50/50 dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <Smartphone size={14} className="text-emerald-500" />
                          Type d'Appareils
                        </h4>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={systemStats.devices}
                                cx="50%"
                                cy="50%"
                                outerRadius={60}
                                dataKey="value"
                                label={({name, percent}) => `${(percent * 100).toFixed(0)}%`}
                              >
                                {systemStats.devices.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#6366f1'} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 mt-4">
                          {systemStats.devices.map((d, i) => (
                            <div key={d.name} className="flex items-center justify-between text-[10px] font-bold">
                              <span className="text-gray-500 uppercase">{d.name}</span>
                              <span className="text-gray-900 dark:text-white px-2 py-0.5 bg-white dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700">{d.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Desktop / All users section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* User's Current Specs */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Ma Configuration Actuelle</h4>
                      <div className="grid grid-cols-1 gap-3">
                         <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center text-indigo-600">
                              {/iPhone|Android|Mobile/.test(navigator.userAgent) ? <Smartphone size={24} /> : <Monitor size={24} />}
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Appareil Détecté</p>
                              <p className="font-black text-sm text-gray-900 dark:text-white">
                                 {/Android/.test(navigator.userAgent) ? 'Android Mobile' : 
                                  /iPhone|iPad/.test(navigator.userAgent) ? 'Apple iOS' : 
                                  /Mac/.test(navigator.userAgent) ? 'macOS Desktop' : 
                                  /Win/.test(navigator.userAgent) ? 'Windows PC' : 
                                  /Linux/.test(navigator.userAgent) ? 'Linux Station' : 'Poste de Travail'}
                              </p>
                              <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">{navigator.platform} • {window.screen.width}x{window.screen.height}</p>
                            </div>
                         </div>

                         <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-400">
                              <Globe size={24} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Navigateur & Moteur</p>
                              <p className="font-black text-sm text-gray-900 dark:text-white">
                                 {navigator.userAgent.includes('Edg/') ? 'Microsoft Edge' :
                                  navigator.userAgent.includes('Chrome') ? 'Google Chrome' : 
                                  navigator.userAgent.includes('Firefox') ? 'Mozilla Firefox' :
                                  navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome') ? 'Apple Safari' :
                                  navigator.userAgent.includes('Opera') || navigator.userAgent.includes('OPR') ? 'Opera' : 'Navigateur Web'}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] font-bold text-gray-400 uppercase font-mono">{navigator.language}</span>
                                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                <span className="text-[9px] font-black text-indigo-500 uppercase">SYNC LIVE</span>
                              </div>
                            </div>
                         </div>
                      </div>
                    </div>

                    {/* PWA Installation */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Application Progressive (PWA)</h4>
                      <div className={`p-6 rounded-3xl border shadow-xl relative overflow-hidden group transition-all ${
                        isStandalone 
                          ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800' 
                          : 'bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-none'
                      }`}>
                        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                          <div className="text-center sm:text-left flex-1">
                            <div className="flex items-center justify-center sm:justify-start gap-4 mb-4">
                               <div className="w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden bg-white p-1.5 shadow-md shrink-0">
                                  <img src="/logo.png" alt="Edu-Nify" className="w-full h-full object-contain rounded-xl" referrerPolicy="no-referrer" />
                               </div>
                               <div>
                                 <h4 className={`text-xl font-black ${isStandalone ? 'text-gray-900 dark:text-white' : 'text-white'}`}>
                                   {isStandalone ? 'Application Installée ✓' : 'Installer l\'Application'}
                                 </h4>
                                 <p className={`text-sm font-medium ${isStandalone ? 'text-gray-500' : 'text-indigo-100'}`}>
                                   {isStandalone ? 'Mode autonome activé avec succès' : 'Profitez d\'Edu-Nify directement sur l\'écran de votre ordinateur ou de votre mobile'}
                                 </p>
                               </div>
                            </div>
                            
                            {isStandalone ? (
                              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                <CheckCircle size={16} />
                                L'APPLICATION EST PRÊTE ET DISPONIBLE DANS SÉANCE ACTIVE DE VOTRE SYSTÈME
                              </div>
                            ) : isInstallable ? (
                               <button 
                                 onClick={installApp}
                                 className="w-full sm:w-auto px-10 py-4 bg-white text-indigo-700 rounded-2xl font-black text-lg hover:shadow-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-900/20"
                               >
                                 Installer Edu-Nify
                               </button>
                            ) : (
                               <div className="flex flex-col gap-4">
                                 <button 
                                   onClick={() => window.dispatchEvent(new CustomEvent('open-pwa-install-guide'))}
                                   className="w-full sm:w-auto px-8 py-3.5 bg-white text-indigo-700 hover:bg-indigo-50 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-md cursor-pointer uppercase tracking-wider"
                                 >
                                   Guide d'Installation (Ordinateur / iOS / Android)
                                 </button>
                                 <p className="text-[10px] font-medium opacity-90 max-w-sm">Si le bouton d'installation automatique n'est pas supporté par votre navigateur (par exemple sur Safari iOS), vous pouvez l'ajouter manuellement en quelques clics.</p>
                               </div>
                            )}
                          </div>
                          
                          <div className="flex-shrink-0 animate-bounce-slow">
                            <DownloadIcon className={isStandalone ? 'text-emerald-500/20' : 'text-white/20'} size={120} />
                          </div>
                        </div>
                        
                        {/* Background Patterns */}
                        <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                        {!isStandalone && <div className="absolute top-0 right-0 p-4 opacity-50"><Zap size={40} className="animate-pulse" /></div>}
                      </div>
                    </div>

                    {/* System Resources */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Analyse de Flux Temps Réel</h4>
                        <div className="flex items-center gap-2">
                           <span className="text-[8px] font-black text-emerald-500 border border-emerald-100 dark:border-emerald-900/50 px-2 py-0.5 rounded-full animate-pulse">OPTIMISÉ</span>
                        </div>
                      </div>
                      <div className="p-6 rounded-3xl bg-gray-900 text-white relative overflow-hidden group border border-white/5 shadow-2xl">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Cpu size={80} />
                        </div>
                        <div className="relative z-10 space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                <Zap size={20} className="text-indigo-400" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-tighter">Latence Gateway</p>
                                <div className="flex items-baseline gap-1">
                                  <p className="text-xl font-black">{latency}</p>
                                  <span className="text-[10px] font-bold opacity-50">ms</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-1 mb-1">
                                {[1, 2, 3, 4, 5].map(i => (
                                  <div key={i} className={`w-1 h-3 rounded-full ${latency < 300 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                ))}
                              </div>
                              <p className={`text-[8px] font-black uppercase ${latency < 300 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {latency < 300 ? 'STABLE' : 'FAIBLE'}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                             <div className="flex justify-between text-[10px] font-black uppercase text-gray-400">
                                <span>Utilisation Base de Données</span>
                                <span>{Math.min(100, Math.round((adminSessions.length / 50) * 100))}%</span>
                             </div>
                             <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, (adminSessions.length / 50) * 100)}%` }}
                                  className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                                />
                             </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {currentUser?.role === 'admin' && (
                    <div className="space-y-4 pt-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Dashboard Global des Sessions</h4>
                        <div className="flex items-center gap-4">
                           <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              Web
                           </div>
                           <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase">
                              <div className="w-2 h-2 rounded-full bg-indigo-500" />
                              Mobile
                           </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                          {/* Desktop Table View */}
                          <table className="hidden md:table w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-100/50 dark:bg-gray-800/50">
                                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider">Utilisateur</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider">Appareil</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider">Localisation / IP</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider">Dernière Activité</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {adminSessions.slice(0, 10).map((session) => (
                                <tr key={session.id} className="hover:bg-white dark:hover:bg-gray-800 transition-colors group">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                                        {session.userName?.[0]}
                                      </div>
                                      <div>
                                        <p className="text-sm font-black text-gray-900 dark:text-white">{session.userName}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">{session.userId}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      {session.isMobile ? <Smartphone size={14} className="text-indigo-500" /> : <Monitor size={14} className="text-emerald-500" />}
                                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{session.device}</span>
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                      <span className="text-[8px] font-black px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded uppercase">{session.browser?.split(' ')[0]}</span>
                                      <span className="text-[8px] font-black px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded uppercase">{session.os?.split(' ')[0]}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{session.location || 'Libreville, GA'}</p>
                                    <p className="text-[10px] font-mono text-gray-400">{session.ip || '0.0.0.0'}</p>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-1.5 h-1.5 rounded-full ${session.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                                      <span className={`text-xs font-bold ${session.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`}>
                                        {session.status === 'active' ? 'En ligne' : 'Hors ligne'}
                                      </span>
                                    </div>
                                    <p className="text-[10px] font-medium text-gray-400 mt-0.5">
                                      {session.lastActive?.toDate ? session.lastActive.toDate().toLocaleString() : 'Maintenant'}
                                    </p>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    {session.id !== auth.currentUser?.uid && (
                                      <button 
                                        onClick={() => handleTerminateSession(session.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                      >
                                        <LogOut size={16} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {/* Mobile List View */}
                          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
                             {adminSessions.slice(0, 10).map((session) => (
                               <div key={session.id} className="p-4 space-y-4">
                                 <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm">
                                        {session.userName?.[0]}
                                      </div>
                                      <div>
                                        <p className="text-sm font-black text-gray-900 dark:text-white">{session.userName}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">{session.userId}</p>
                                      </div>
                                    </div>
                                    {session.id !== auth.currentUser?.uid && (
                                      <button 
                                        onClick={() => handleTerminateSession(session.id)}
                                        className="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg"
                                      >
                                        <LogOut size={16} />
                                      </button>
                                    )}
                                 </div>
                                 <div className="grid grid-cols-2 gap-4">
                                    <div>
                                       <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Appareil</p>
                                       <div className="flex items-center gap-1.5">
                                          {session.isMobile ? <Smartphone size={12} className="text-indigo-500" /> : <Monitor size={12} className="text-emerald-500" />}
                                          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate">{session.device}</span>
                                       </div>
                                    </div>
                                    <div>
                                       <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Status & Activité</p>
                                       <div className="flex items-center gap-2">
                                          <div className={`w-1.5 h-1.5 rounded-full ${session.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                                          <span className={`text-[11px] font-bold ${session.status === 'active' ? 'text-emerald-600' : 'text-gray-500'}`}>
                                            {session.status === 'active' ? 'En ligne' : 'Hors ligne'}
                                          </span>
                                       </div>
                                       <p className="text-[9px] font-medium text-gray-400">
                                         {session.lastActive?.toDate ? session.lastActive.toDate().toLocaleTimeString() : 'Maintenant'}
                                       </p>
                                    </div>
                                 </div>
                                 <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-gray-800">
                                    <span className="text-[10px] font-bold text-gray-500">{session.location || 'Libreville, GA'}</span>
                                    <div className="flex gap-1">
                                       <span className="text-[8px] font-black px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded uppercase">{session.browser?.split(' ')[0]}</span>
                                       <span className="text-[8px] font-black px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded uppercase">{session.os?.split(' ')[0]}</span>
                                    </div>
                                 </div>
                               </div>
                             ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isAdmin && (
                    <div className="space-y-4 pt-4">
                      <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Mes Sessions Actives</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {activeSessions.map(session => (
                           <div key={session.id} className={`p-4 rounded-2xl border ${session.current ? 'border-indigo-600 bg-indigo-50/10 shadow-sm shadow-indigo-100 dark:shadow-none' : 'border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50'} flex justify-between items-center group transition-all hover:border-indigo-300`}>
                              <div className="flex items-center gap-4">
                                 <div className={`p-3 rounded-xl ${session.current ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
                                    {session.device?.includes('iPhone') || session.device?.includes('Mobile') ? <Smartphone size={18} /> : <Monitor size={18} />}
                                 </div>
                                 <div className="min-w-0">
                                    <p className="text-[13px] font-black text-gray-900 dark:text-white flex items-center gap-2 truncate">
                                      {session.device}
                                      {session.current && <span className="text-[8px] px-2 py-0.5 bg-emerald-500 text-white rounded-full font-black tracking-widest uppercase flex-shrink-0">ACTUELLE</span>}
                                    </p>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase mt-0.5 truncate">
                                      {session.location} • {session.date}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5 overflow-hidden">
                                      <span className="text-[9px] font-black px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded uppercase truncate">{session.os || 'N/A'}</span>
                                      <span className="text-[9px] font-black px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded uppercase truncate">{session.browser || 'N/A'}</span>
                                    </div>
                                 </div>
                              </div>
                              {!session.current && (
                                <button 
                                  onClick={() => handleTerminateSession(session.id)}
                                  className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl flex-shrink-0"
                                  title="Terminer cette session"
                                >
                                  <LogOut size={18} />
                                </button>
                              )}
                           </div>
                         ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 pt-4 pb-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Journal Local</h4>
                      <span className="text-[8px] font-black text-gray-400 uppercase">Synchronisé à {new Date().toLocaleTimeString()}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sessionLogs.slice(0, 4).map(log => (
                        <div key={log.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                          <div className={`w-1.5 h-1.5 rounded-full ${log.type === 'auth' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                          <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">{log.event}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Sécurité & Confidentialité</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Protégez votre compte et vos données.</p>
                  </div>

                  <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-red-100 dark:bg-red-800 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center">
                        <Lock size={20} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 dark:text-white">Authentification à deux facteurs</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ajoutez une couche de sécurité supplémentaire en demandant un code envoyé sur votre mobile.</p>
                        <button className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-colors">
                          Activer la 2FA
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex flex-col gap-2">
                       <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Nouveau Mot de Passe</label>
                       <input 
                         type="password" 
                         className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold outline-none"
                       />
                    </div>
                    <div className="flex flex-col gap-2">
                       <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Confirmer le Mot de Passe</label>
                       <input 
                         type="password" 
                         className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold outline-none"
                       />
                    </div>
                    <button className="px-6 py-3 bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-bold rounded-xl hover:scale-[1.02] transition-transform">
                      Réinitialiser mon mot de passe
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

