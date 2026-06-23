import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MandatoryPasswordChange from './components/MandatoryPasswordChange';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import Classes from './pages/Classes';
import Settings from './pages/Settings';
import IntegrationCode from './pages/IntegrationCode';
import Scanner from './pages/Scanner';
import MobileApp from './pages/MobileApp';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import BiometricRegistration from './pages/BiometricRegistration';
import StudentCard from './pages/StudentCard';
import KioskMode from './pages/KioskMode';
import Leaderboard from './pages/Leaderboard';
import RecentConnections from './pages/RecentConnections';
import Classroom from './pages/Classroom';
import Profile from './pages/Profile';
import Houses from './pages/Houses';
import Calendar from './pages/Calendar';
import NewsFeed from './pages/NewsFeed';
import Directory from './pages/Directory';
import Messaging from './pages/Messaging';
import About from './pages/About';
import AIAssistant from './pages/AIAssistant';
import TeacherPlanning from './pages/TeacherPlanning';
import CoursesSubjects from './pages/CoursesSubjects';
import ParentDashboard from './pages/ParentDashboard';
import Grades from './pages/Grades';
import Homework from './pages/Homework';
import Finance from './pages/Finance';
import Discipline from './pages/Discipline';
import AuditLogs from './pages/AuditLogs';
import Clubs from './pages/Clubs';
import LudoAIPlus from './pages/LudoAIPlus';
import TermsAndConditions from './pages/TermsAndConditions';
import Staff from './pages/Staff';
import ResponsibilityZones from './pages/ResponsibilityZones';
import Library from './pages/Library';
import Canteen from './pages/Canteen';
import CanteenDashboard from './pages/CanteenDashboard';
import Surveys from './pages/Surveys';
import DocumentGenerator from './pages/DocumentGenerator';
import StrategicOptimizations from './pages/StrategicOptimizations';
import { runMaintenance } from './services/MaintenanceService';
import { isFirebaseConfigured } from './lib/firebase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { EstablishmentProvider, useEstablishment } from './contexts/EstablishmentContext';
import Establishments from './pages/Establishments';
import ReloadPrompt from './components/ReloadPrompt';
import PWAPrompt from './components/PWAPrompt';
import Footer from './components/Footer';
import { Ban } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';

function AppContent() {
  const { currentUser } = useAuth();
  const { isSuperAdmin } = useEstablishment();
  console.log("AppContent rendering. CurrentUser:", currentUser ? currentUser.email : "None");
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tabParams, setTabParams] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
        setTabParams(event.state.params || null);
      } else {
        // Default to dashboard if no state
        setActiveTab(currentUser?.role === 'élève' ? 'student_dashboard' : 'dashboard');
        setTabParams(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Initialize history state for the first load
    if (!window.history.state) {
      window.history.replaceState({ tab: activeTab, params: tabParams }, '');
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'élève' && activeTab === 'dashboard') {
      setActiveTab('student_dashboard');
    }

    // Run maintenance if admin
    if (currentUser?.role === 'admin') {
      runMaintenance(currentUser.role);
    }
  }, [currentUser, activeTab]);

  const handleNavigate = (tab: string, params?: any) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      setTabParams(params || null);
      // Push to browser history
      window.history.pushState({ tab, params }, '');
    }
  };

  const { logout } = useAuth();

  if (currentUser?.accessBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100 dark:border-red-900/30">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <Ban size={40} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Accès Restreint</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Votre accès à l'application a été suspendu par l'administrateur de l'établissement. 
            Veuillez contacter l'administration pour plus d'informations.
          </p>
          <button 
            onClick={() => logout()}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  // Si la modification du mot de passe est obligatoire (première connexion)
  if (currentUser.mustChangePassword) {
    return <MandatoryPasswordChange />;
  }

  // Si l'utilisateur n'a pas complété son inscription biométrique (on contourne pour tous les administrateurs et super-admins)
  const isSuperAdminUser = currentUser?.email?.toLowerCase().trim() === 'martinienmvezogo@gmail.com' ||
                           currentUser?.preciseRole === 'Super Admin' ||
                           currentUser?.preciseRole === 'Super Administrateur';
  const isBypassBiometrics = isSuperAdminUser || currentUser?.role === 'admin';
  if (!isBypassBiometrics && (!currentUser.face_id || !currentUser.fingerprint_id)) {
    return <BiometricRegistration />;
  }

  const renderContent = () => {
    const role = currentUser?.role || '';
    const isAdmin = role === 'admin' || isSuperAdmin;
    
    switch (activeTab) {
      case 'kiosk':
        return isAdmin ? <KioskMode onExit={() => setActiveTab('users')} /> : <Dashboard onNavigate={handleNavigate} />;
      case 'dashboard': 
        if (role === 'parent') return <ParentDashboard onNavigate={handleNavigate} />;
        if (role === 'cuisinier') return <CanteenDashboard onNavigate={handleNavigate} />;
        return (isAdmin || ['enseignant', 'personnel administratif'].includes(role)) ? <Dashboard onNavigate={handleNavigate} /> : <StudentDashboard onNavigate={handleNavigate} />;
      case 'student_dashboard': 
        return role === 'élève' ? <StudentDashboard onNavigate={handleNavigate} /> : <Dashboard onNavigate={handleNavigate} />;
      case 'parent_dashboard':
        return role === 'parent' ? <ParentDashboard onNavigate={handleNavigate} /> : <Dashboard onNavigate={handleNavigate} />;
      case 'student_card': 
        return role === 'élève' ? <StudentCard /> : <Dashboard onNavigate={handleNavigate} />;
      case 'users': 
        return isAdmin ? <Users /> : <Dashboard onNavigate={handleNavigate} />;
      case 'attendance': 
        return (isAdmin || ['enseignant', 'personnel administratif'].includes(role)) ? <Attendance /> : <StudentDashboard onNavigate={handleNavigate} />;
      case 'reports': 
        return (isAdmin || ['enseignant', 'personnel administratif'].includes(role)) ? <Reports /> : <StudentDashboard onNavigate={handleNavigate} />;
      case 'classes': 
        return isAdmin ? <Classes /> : <Classroom initialClassName={tabParams?.className} />;
      case 'settings': 
        return <Settings />;
      case 'scanner': 
        return isAdmin ? <Scanner /> : <Dashboard onNavigate={handleNavigate} />;
      case 'mobile_app': 
        return isAdmin ? <MobileApp /> : <Dashboard onNavigate={handleNavigate} />;
      case 'integration': 
        return isAdmin ? <IntegrationCode /> : <Dashboard onNavigate={handleNavigate} />;
      case 'leaderboard': return <Leaderboard />;
      case 'houses': return <Houses />;
      case 'classroom': 
        return (isAdmin || ['enseignant', 'élève'].includes(role)) ? <Classroom initialClassName={tabParams?.className} /> : <Dashboard onNavigate={handleNavigate} />;
      case 'courses_subjects':
        return role !== 'parent' ? <CoursesSubjects initialPrepId={tabParams?.prepId} /> : <Dashboard onNavigate={handleNavigate} />;
      case 'planning':
        return (isAdmin || ['enseignant', 'élève'].includes(role)) ? <TeacherPlanning /> : <Dashboard onNavigate={handleNavigate} />;
      case 'calendar': 
        return (isAdmin || ['enseignant', 'personnel administratif'].includes(role)) ? <Calendar /> : <StudentDashboard onNavigate={handleNavigate} />;
      case 'newsfeed': return <NewsFeed />;
      case 'ai_assistant': 
        return (isAdmin || ['enseignant'].includes(role)) ? <AIAssistant onNavigate={handleNavigate} /> : <StudentDashboard onNavigate={handleNavigate} />;
      case 'directory': 
        return (isAdmin || ['enseignant', 'personnel administratif'].includes(role)) ? <Directory onNavigate={handleNavigate} /> : <StudentDashboard onNavigate={handleNavigate} />;
      case 'messaging': return <Messaging initialChatTargetId={tabParams?.userId} onClearTarget={() => setTabParams(null)} />;
      case 'grades': return <Grades />;
      case 'homework': return <Homework />;
      case 'ludo_ai_plus': return <LudoAIPlus />;
      case 'clubs': return <Clubs />;
      case 'finance': return (isAdmin || (role as string) === 'comptable' || (role as string) === 'gestionnaire_comptable' || (role === 'personnel administratif' && currentUser?.position === 'comptable')) ? <Finance /> : <Dashboard onNavigate={handleNavigate} />;
      case 'discipline': return (isAdmin || ['enseignant', 'personnel administratif'].includes(role)) ? <Discipline /> : <Dashboard onNavigate={handleNavigate} />;
      case 'audit_logs': return isAdmin ? <AuditLogs /> : <Dashboard onNavigate={handleNavigate} />;
      case 'recent_connections': 
        return isAdmin ? <RecentConnections /> : <Dashboard onNavigate={handleNavigate} />;
      case 'staff':
        return (isAdmin || ['personnel administratif', 'enseignant'].includes(role)) ? <Staff /> : <Dashboard onNavigate={handleNavigate} />;
      case 'responsibility_zones':
        return (isAdmin || ['personnel administratif', 'enseignant'].includes(role)) ? <ResponsibilityZones /> : <Dashboard onNavigate={handleNavigate} />;
      case 'library':
        return <Library />;
      case 'canteen':
        return (isAdmin || ['enseignant', 'élève', 'parent', 'cuisinier', 'personnel administratif'].includes(role)) ? <Canteen /> : <Dashboard onNavigate={handleNavigate} />;
      case 'surveys':
        return <Surveys />;
      case 'document_generator':
        return (isAdmin || ['personnel administratif'].includes(role)) ? <DocumentGenerator /> : <Dashboard onNavigate={handleNavigate} />;
      case 'strategic_optimizations':
        return (isAdmin || ['enseignant'].includes(role)) ? <StrategicOptimizations /> : <Dashboard onNavigate={handleNavigate} />;
      case 'profile': return <Profile />;
      case 'establishments':
        return isAdmin ? <Establishments /> : <Dashboard onNavigate={handleNavigate} />;
      case 'about': return <About />;
      case 'terms': return <TermsAndConditions />;
      default: return role === 'élève' ? <StudentDashboard onNavigate={handleNavigate} /> : <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 print:bg-white print:h-auto transition-colors duration-200">
      <Sidebar activeTab={activeTab} setActiveTab={handleNavigate} isMobileOpen={isSidebarOpen} setIsMobileOpen={setIsSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible">
        <Header activeTab={activeTab} setActiveTab={handleNavigate} onMenuClick={() => setIsSidebarOpen(true)} />
        {!isFirebaseConfigured && (
          <div className="bg-amber-100 text-amber-800 p-3 text-center text-sm font-medium flex items-center justify-center gap-2">
            ⚠️ Firebase n'est pas configuré. Ajoutez vos clés d'API dans les variables d'environnement (Settings &gt; Environment Variables) avec les clés VITE_FIREBASE_*.
          </div>
        )}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 print:overflow-visible print:bg-white print:p-0 transition-colors duration-200">
          <div className="min-h-full flex flex-col">
            <div className="flex-1">
              {renderContent()}
            </div>
            <Footer onNavigate={handleNavigate} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <EstablishmentProvider>
              <NotificationProvider>
                <AppContent />
                <ReloadPrompt />
                <PWAPrompt />
              </NotificationProvider>
            </EstablishmentProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
