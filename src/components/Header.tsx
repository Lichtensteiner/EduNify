import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, UserCircle, Clock, Check, Info, Globe, X, Menu, Download, Trash2, AlertTriangle, CheckCircle, ArrowLeft, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage, Language } from '../contexts/LanguageContext';
import { useEstablishment } from '../contexts/EstablishmentContext';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';

interface Notification {
  id: string;
  title: string;
  message: string;
  content?: string;
  read: boolean;
  timestamp: string;
  type?: 'info' | 'warning' | 'success';
  targetTab?: string;
}

interface HeaderProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  onMenuClick?: () => void;
}

export default function Header({ activeTab, setActiveTab, onMenuClick }: HeaderProps) {
  const { currentUser } = useAuth();
  const { currentEstablishment, establishments, changeActiveEstablishment, isSuperAdmin } = useEstablishment();
  const { language, setLanguage, t } = useLanguage();
  const [time, setTime] = useState(new Date());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedNotificationState, setSelectedNotificationState] = useState<Notification | null>(null);

  const isDashboard = activeTab === 'dashboard' || activeTab === 'student_dashboard';

  const handleBack = () => {
    window.history.back();
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.modal === 'header_notification') {
        // We shouldn't really enter this state from a pop, but just in case
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
      window.history.pushState({ modal: 'header_notification' }, '');
    } else {
      if (window.history.state?.modal === 'header_notification') {
        window.history.back();
      }
    }
  };

  const [showLangMenu, setShowLangMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const languages: { code: Language; name: string; flag: string }[] = [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
  ];

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !currentUser) return;

    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', currentUser.id)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
      
      // Sort manually to avoid requiring a composite index in Firestore
      notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setNotifications(notifs);
    }, (error) => {
      console.error("Erreur lors de la récupération des notifications:", error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim() || !isFirebaseConfigured || currentUser?.role === 'élève') {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const fetchResults = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const usersSnap = await getDocs(collection(db, 'users'));
        const queryLower = searchQuery.toLowerCase();
        
        const results = usersSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(user => 
            (user.nom?.toLowerCase() || '').includes(queryLower) ||
            (user.prenom?.toLowerCase() || '').includes(queryLower) ||
            (user.email?.toLowerCase() || '').includes(queryLower) ||
            (user.matricule?.toLowerCase() || '').includes(queryLower) ||
            (user.classe?.toLowerCase() || '').includes(queryLower)
          )
          .slice(0, 5); // Limit to 5 results
          
        setSearchResults(results);
        setShowSearchResults(true);
      } catch (error) {
        console.error("Error searching users:", error);
      }
    };

    const debounceTimer = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, currentUser]);

  const handleNotificationClick = (notif: Notification) => {
    // If there is long content, always show the modal first
    if (notif.content) {
      setSelectedNotification(notif);
      if (!notif.read) {
        markAsRead(notif.id);
      }
      setShowNotifications(false);
      return;
    }

    if (notif.targetTab && setActiveTab) {
      setActiveTab(notif.targetTab);
      setShowNotifications(false);
      if (!notif.read) {
        markAsRead(notif.id);
      }
      return;
    }
    
    setSelectedNotification(notif);
    if (!notif.read) {
      markAsRead(notif.id);
    }
    setShowNotifications(false);
  };

  const markAsRead = async (id: string) => {
    if (!isFirebaseConfigured) return;
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la notification:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!isFirebaseConfigured) return;
    try {
      const unreadNotifs = notifications.filter(n => !n.read);
      for (const notif of unreadNotifs) {
        await updateDoc(doc(db, 'notifications', notif.id), { read: true });
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour des notifications:", error);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!isFirebaseConfigured) return;
    try {
      await deleteDoc(doc(db, 'notifications', id));
      setSelectedNotification(null);
    } catch (error) {
      console.error("Erreur lors de la suppression de la notification:", error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 sm:px-6 shrink-0 print:hidden transition-colors duration-200">
      <div className="flex items-center gap-2 sm:gap-4 flex-1">
        {!isDashboard ? (
          <button 
            onClick={handleBack}
            className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
        ) : (
          <button 
            onClick={onMenuClick}
            className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl lg:hidden transition-colors"
          >
            <Menu size={24} />
          </button>
        )}

        {/* Corporate branding details or SaaS switcher dropdown */}
        {isSuperAdmin && establishments.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase font-black text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-150/40 dark:border-indigo-900/30 px-2 py-1 rounded-lg hidden lg:inline font-bold">
              SaaS Académique
            </span>
            <select
              value={currentEstablishment?.id || ''}
              onChange={(e) => changeActiveEstablishment(e.target.value)}
              className="px-2 py-1 bg-gray-55 dark:bg-gray-750 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold outline-none cursor-pointer max-w-[150px] sm:max-w-[220px]"
            >
              {establishments.map(est => (
                <option key={est.id} value={est.id}>
                  {est.id} - {est.nom} {!est.active ? ' (Suspendu)' : ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          currentEstablishment && (
            <div className="hidden lg:flex flex-col text-left mr-2">
              <span className="text-xs font-black text-gray-800 dark:text-gray-100 leading-none">
                {currentEstablishment.nom}
              </span>
              <span className="text-[10px] text-gray-400 font-bold italic mt-0.5 line-clamp-1 max-w-[250px]">
                « {currentEstablishment.devise} »
              </span>
            </div>
          )
        )}

        <div className="relative w-full max-w-xs sm:max-w-md hidden sm:block" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim() && searchResults.length > 0) setShowSearchResults(true);
            }}
            placeholder={t('search_placeholder')} 
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-600 transition-all text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
          
          {showSearchResults && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
              {searchResults.length > 0 ? (
                <div className="py-2">
                  {searchResults.map((user) => (
                    <div 
                      key={user.id} 
                      className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0"
                      onClick={() => {
                        setShowSearchResults(false);
                        setSearchQuery('');
                        if (setActiveTab) setActiveTab('users');
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                          {user.prenom?.[0]}{user.nom?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{user.prenom} {user.nom}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            <span className="capitalize">{user.role}</span>
                            {user.classe && <span>• {user.classe}</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  {t('no_results_found')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-6">
        <div className="hidden md:flex items-center gap-2 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-600">
          <Clock size={18} className="text-indigo-600 dark:text-indigo-400" />
          <span className="font-mono font-medium text-sm tracking-tight">
            {time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        <div className="relative" ref={langRef}>
          <button 
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center gap-2 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
          >
            <span className="text-xl">{languages.find(l => l.code === language)?.flag}</span>
          </button>

          {showLangMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-50 py-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setShowLangMenu(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                    language === lang.code ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  {lang.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button 
          onClick={() => setActiveTab && setActiveTab('settings')}
          className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
          title={t('settings')}
        >
          <Settings size={20} />
        </button>

        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-[8px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('notifications')}</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
                  >
                    <Check size={14} />
                    {t('mark_all_read')}
                  </button>
                )}
              </div>
              <div className="max-h-[32rem] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                    {t('no_notifications')}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-700">
                    {notifications.map((notif) => (
                      <div 
                        key={notif.id} 
                        className={`p-4 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${notif.read ? 'bg-white dark:bg-gray-800' : 'bg-indigo-50/30 dark:bg-indigo-900/20'}`}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className="flex gap-3">
                          <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            notif.read ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                          }`}>
                            <Info size={16} />
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm ${notif.read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white font-medium'}`}>
                              {notif.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {notif.message}
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                              {new Date(notif.timestamp).toLocaleString(undefined, {
                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                          {!notif.read && (
                            <div className="w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full mt-2 shrink-0"></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
        
        <button 
          onClick={() => setActiveTab && setActiveTab('profile')}
          className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-xl transition-colors"
        >
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {currentUser?.prenom || currentUser?.nom ? `${currentUser?.prenom || ''} ${currentUser?.nom || ''}`.trim() : currentUser?.email?.split('@')[0] || 'Admin'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{currentUser?.role}</p>
          </div>
          {currentUser?.photo ? (
            <img src={currentUser.photo} alt="" className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm uppercase">
              {currentUser?.prenom?.[0] || currentUser?.email?.[0] || 'A'}
            </div>
          )}
        </button>
      </div>
    </header>
    
    {/* Notification Details Modal */}
    {selectedNotification && (
      <div className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up sm:animate-fade-in flex flex-col max-h-[90vh]">
          <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 shrink-0 min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                selectedNotification.type === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                selectedNotification.type === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                {selectedNotification.type === 'warning' ? <AlertTriangle size={20} /> :
                 selectedNotification.type === 'success' ? <CheckCircle size={20} /> :
                 <Info size={20} />}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">{selectedNotification.title}</h3>
            </div>
            <button onClick={() => setSelectedNotification(null)} className="ml-4 shrink-0 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 p-2 rounded-full">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1">
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed text-base break-words">
              {selectedNotification.content || selectedNotification.message}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-6 flex items-center gap-1.5">
              <Clock size={14} />
              {new Date(selectedNotification.timestamp).toLocaleString(undefined, {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center shrink-0">
            <button 
              onClick={() => deleteNotification(selectedNotification.id)}
              className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-medium text-sm transition-colors flex items-center gap-2"
            >
              <Trash2 size={18} />
              {t('delete')}
            </button>
            <div className="flex items-center gap-3">
              {selectedNotification.targetTab && setActiveTab && (
                <button 
                  onClick={() => {
                    setActiveTab(selectedNotification.targetTab!);
                    setSelectedNotification(null);
                  }}
                  className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/70 font-medium text-sm transition-colors"
                >
                  Accéder
                </button>
              )}
              <button 
                onClick={() => setSelectedNotification(null)}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium text-sm transition-colors"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
