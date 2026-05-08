import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, CalendarCheck, FileText, Settings, BookOpen, Code, LogOut, ScanLine, Smartphone, IdCard, Trophy, ScanFace, Activity, GraduationCap, UserCircle, Castle, X, Download, Calendar as CalendarIcon, MessageSquare, BookUser, MessageCircle, Info, Sparkles, Wallet, ShieldAlert, History, Award, ShieldCheck, Scale, Utensils, Library, Vote, FileBadge } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (isOpen: boolean) => void;
}

export default function Sidebar({ activeTab, setActiveTab, isMobileOpen, setIsMobileOpen }: SidebarProps) {
  const { currentUser, logout } = useAuth();
  const { t, tData } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUser.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.unreadCounts && data.unreadCounts[currentUser.id]) {
          count += data.unreadCounts[currentUser.id];
        }
      });
      setTotalUnreadCount(count);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    // Check if already installed
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      setIsStandalone(!!isStandaloneMode);
    };
    
    checkStandalone();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', checkStandalone);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // If no prompt is available (like on iOS), show the guide
      setShowInstallGuide(true);
    }
  };

  const categories = [
    {
      title: t('main_category'),
      items: [
        { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard, roles: ['admin', 'enseignant', 'personnel administratif', 'parent'] },
        { id: 'student_dashboard', labelKey: 'student_dashboard', icon: LayoutDashboard, roles: ['élève'] },
        { id: 'newsfeed', labelKey: 'newsfeed', icon: MessageSquare, roles: ['admin', 'enseignant', 'personnel administratif', 'élève', 'parent'] },
        { id: 'directory', labelKey: 'directory', icon: BookUser, roles: ['admin', 'enseignant', 'personnel administratif'] },
        { id: 'messaging', labelKey: 'messaging', icon: MessageCircle, roles: ['admin', 'enseignant', 'personnel administratif', 'élève', 'parent'] },
        { id: 'profile', labelKey: 'profile', icon: UserCircle, roles: ['admin', 'enseignant', 'personnel administratif', 'élève', 'parent'] },
        { id: 'about', labelKey: 'about', icon: Info, roles: ['admin', 'enseignant', 'personnel administratif', 'élève', 'parent'] },
        { id: 'terms', labelKey: 'terms_and_conditions', icon: ShieldCheck, roles: ['admin', 'enseignant', 'personnel administratif', 'élève', 'parent'] },
      ]
    },
    {
      title: t('schooling_category'),
      items: [
        { id: 'classroom', labelKey: 'classroom', icon: GraduationCap, roles: ['admin', 'enseignant', 'élève'] },
        { id: 'homework', labelKey: 'homework', icon: BookOpen, roles: ['admin', 'enseignant', 'élève', 'parent'] },
        { id: 'grades', labelKey: 'grades', icon: FileText, roles: ['admin', 'enseignant', 'élève', 'parent'] },
        { id: 'ludo_ai_plus', labelKey: 'ludo_ai_plus', icon: Sparkles, roles: ['élève', 'admin'] },
        { id: 'courses_subjects', labelKey: 'courses_subjects', icon: BookOpen, roles: ['enseignant', 'admin'] },
        { id: 'ai_assistant', labelKey: 'ai_assistant', icon: Sparkles, roles: ['enseignant', 'admin'] },
        { id: 'classes', labelKey: 'classes', icon: BookOpen, roles: ['admin'] },
        { id: 'calendar', labelKey: 'calendar', icon: CalendarIcon, roles: ['admin', 'enseignant', 'personnel administratif'] },
        { id: 'attendance', labelKey: 'attendance', icon: CalendarCheck, roles: ['admin', 'enseignant', 'personnel administratif'] },
        { id: 'reports', labelKey: 'reports', icon: FileText, roles: ['admin', 'enseignant', 'personnel administratif'] },
      ]
    },
    {
      title: t('student_life_category'),
      items: [
        { id: 'student_card', labelKey: 'student_card', icon: IdCard, roles: ['élève'] },
        { id: 'houses', labelKey: 'houses', icon: Castle, roles: ['admin', 'enseignant', 'élève', 'parent'] },
        { id: 'clubs', labelKey: 'clubs', icon: Award, roles: ['admin', 'enseignant', 'élève', 'parent'] },
        { id: 'leaderboard', labelKey: 'leaderboard', icon: Trophy, roles: ['admin', 'enseignant', 'élève', 'parent'] },
        { id: 'library', labelKey: 'library', icon: Library, roles: ['admin', 'enseignant', 'élève', 'parent'] },
        { id: 'canteen', labelKey: 'canteen', icon: Utensils, roles: ['admin', 'élève', 'parent', 'cuisinier'] },
        { id: 'surveys', labelKey: 'surveys', icon: Vote, roles: ['admin', 'enseignant', 'élève', 'parent'] },
      ]
    },
    {
      title: t('administration_category'),
      items: [
        { id: 'users', labelKey: 'users', icon: Users, roles: ['admin'] },
        { id: 'staff', labelKey: 'admin_staff', icon: Scale, roles: ['admin', 'personnel administratif'] },
        { id: 'document_generator', labelKey: 'document_generator', icon: FileBadge, roles: ['admin', 'personnel administratif'] },
        { id: 'finance', labelKey: 'finance', icon: Wallet, roles: ['admin'] },
        { id: 'discipline', labelKey: 'discipline', icon: ShieldAlert, roles: ['admin', 'enseignant', 'personnel administratif'] },
        { id: 'recent_connections', labelKey: 'recent_connections', icon: Activity, roles: ['admin'] },
        { id: 'audit_logs', labelKey: 'audit_logs', icon: History, roles: ['admin'] },
        { id: 'scanner', labelKey: 'scanner', icon: ScanLine, roles: ['admin'] },
        { id: 'kiosk', labelKey: 'kiosk', icon: ScanFace, roles: ['admin'] },
        { id: 'mobile_app', labelKey: 'mobile_app', icon: Smartphone, roles: ['admin'] },
        { id: 'integration', labelKey: 'integration', icon: Code, roles: ['admin'] },
        { id: 'settings', labelKey: 'settings', icon: Settings, roles: ['admin'] },
      ]
    }
  ];

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    if (setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col print:hidden transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Edu-Nify" className="h-10 object-contain" />
          </div>
          <button 
            onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="flex-1 py-4 px-4 overflow-y-auto custom-scrollbar">
          {categories.map((category, idx) => {
            const filteredItems = category.items.filter(item => 
              item.roles.includes(currentUser?.role || '')
            );
            if (filteredItems.length === 0) return null;

            return (
              <div key={idx} className="mb-6 last:mb-0">
                <h3 className="px-4 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {category.title}
                </h3>
                <div className="space-y-1">
                  {filteredItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleTabClick(item.id)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-colors ${
                          isActive 
                            ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-medium' 
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={20} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'} />
                          <span className="truncate">{t(item.labelKey)}</span>
                        </div>
                        {item.id === 'messaging' && totalUnreadCount > 0 && (
                          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 shrink-0 space-y-4">
          {currentUser && (
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 mb-2">
              {currentUser.photo ? (
                <img src={currentUser.photo} alt="" className="w-10 h-10 rounded-full object-cover shadow-sm" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm uppercase shadow-sm">
                  {currentUser.prenom?.[0] || currentUser.email?.[0] || 'U'}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                  {currentUser.prenom || currentUser.nom ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : currentUser.email.split('@')[0]}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">{tData(currentUser.role)}</p>
              </div>
            </div>
          )}
          {!isStandalone && (
            <button 
              onClick={handleInstallClick}
              className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
            >
              <Download size={20} />
              {t('install_app')}
            </button>
          )}
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            {t('logout')}
          </button>
        </div>
      </div>

      {/* Install Guide Modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Download size={20} className="text-indigo-600 dark:text-indigo-400" />
                {t('install_app_title')}
              </h3>
              <button
                onClick={() => setShowInstallGuide(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-gray-600 dark:text-gray-300">
              <p>{t('install_app_desc')}</p>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl space-y-2 border border-gray-100 dark:border-gray-600">
                <p className="font-medium text-gray-900 dark:text-white">{t('install_ios')}</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>{t('install_ios_step1')}</li>
                  <li>{t('install_ios_step2')}</li>
                  <li>{t('install_ios_step3')}</li>
                </ol>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl space-y-2 border border-gray-100 dark:border-gray-600">
                <p className="font-medium text-gray-900 dark:text-white">{t('install_android')}</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>{t('install_android_step1')}</li>
                  <li>{t('install_android_step2')}</li>
                </ol>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <button
                onClick={() => setShowInstallGuide(false)}
                className="w-full py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-medium rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t('got_it')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
