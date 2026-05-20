import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, getDocs, where, serverTimestamp } from 'firebase/firestore';
import { 
  Utensils, 
  Plus, 
  Calendar, 
  CreditCard, 
  ChefHat, 
  Info,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  Wallet,
  Coins,
  Edit2,
  EyeOff,
  Smile,
  Star,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface MenuItem {
  id: string;
  day: string;
  starter: string;
  mainCourse: string;
  dessert: string;
  allergens?: string[];
  published?: boolean;
}

interface CanteenAccount {
  id: string;
  userId: string;
  userName: string;
  balance: number;
  restrictions?: string[];
}

interface CanteenFeedback {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  userClass: string;
  day: string;
  menuId: string;
  rating: number;
  comment: string;
  isHealthAlarm: boolean;
  timestamp: any;
}

export default function Canteen() {
  const { t, language } = useLanguage();
  const { currentUser } = useAuth();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [account, setAccount] = useState<CanteenAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MenuItem>>({});
  
  const [feedbacks, setFeedbacks] = useState<CanteenFeedback[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackDay, setFeedbackDay] = useState<string | null>(null);
  const [feedbackMenuId, setFeedbackMenuId] = useState<string>('');
  const [feedbackForm, setFeedbackForm] = useState({
    rating: 5,
    comment: '',
    isHealthAlarm: false
  });
  const [newRestriction, setNewRestriction] = useState('');
  
  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'personnel administratif' || currentUser?.role === 'cuisinier';

  useEffect(() => {
    // Fetch Menu
    const qMenu = query(collection(db, 'canteen_menu'));
    const unsubscribeMenu = onSnapshot(qMenu, (snapshot) => {
      const menuData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MenuItem[];
      setMenu(menuData);
    });

    // Fetch Feedbacks
    const qFeedbacks = query(collection(db, 'canteen_feedbacks'));
    const unsubscribeFeedbacks = onSnapshot(qFeedbacks, (snapshot) => {
      const fbData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CanteenFeedback[];
      fbData.sort((a, b) => {
        const tA = a.timestamp?.seconds || 0;
        const tB = b.timestamp?.seconds || 0;
        return tB - tA;
      });
      setFeedbacks(fbData);
    });

    // Fetch User Canteen Account
    if (currentUser) {
      const qAccount = query(collection(db, 'canteen_accounts'), where('userId', '==', currentUser.id));
      const unsubscribeAccount = onSnapshot(qAccount, (snapshot) => {
        if (!snapshot.empty) {
          setAccount({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CanteenAccount);
        } else if (currentUser.role === 'élève') {
           // Create account if not exists for students
           addDoc(collection(db, 'canteen_accounts'), {
             userId: currentUser.id,
             userName: `${currentUser.prenom} ${currentUser.nom}`,
             balance: 0,
             restrictions: []
           });
        }
        setLoading(false);
      });
      return () => {
        unsubscribeMenu();
        unsubscribeAccount();
        unsubscribeFeedbacks();
      };
    }

    setLoading(false);
    return () => {
      unsubscribeMenu();
      unsubscribeFeedbacks();
    };
  }, [currentUser]);

  const handleSaveMenu = async () => {
    if (!editingDay) return;
    
    try {
      const existingMenu = menu.find(m => m.day === editingDay);
      if (existingMenu) {
        await updateDoc(doc(db, 'canteen_menu', existingMenu.id), {
          starter: editForm.starter || '',
          mainCourse: editForm.mainCourse || '',
          dessert: editForm.dessert || '',
          published: editForm.published ?? false
        });
      } else {
        await addDoc(collection(db, 'canteen_menu'), {
          day: editingDay,
          starter: editForm.starter || '',
          mainCourse: editForm.mainCourse || '',
          dessert: editForm.dessert || '',
          published: editForm.published ?? false
        });
      }
      setEditingDay(null);
    } catch (error) {
      console.error("Error saving menu:", error);
    }
  };

  const togglePublish = async (menuItem: MenuItem) => {
    try {
      await updateDoc(doc(db, 'canteen_menu', menuItem.id), {
        published: !menuItem.published
      });
    } catch (error) {
      console.error("Error toggling publish status:", error);
    }
  };

  const handleTopUp = async () => {
    if (!account || !topUpAmount) return;
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      await updateDoc(doc(db, 'canteen_accounts', account.id), {
        balance: account.balance + amount
      });
      
      // Log transaction
      await addDoc(collection(db, 'canteen_transactions'), {
        userId: currentUser?.id,
        type: 'topup',
        amount,
        timestamp: serverTimestamp()
      });

      setShowTopUp(false);
      setTopUpAmount('');
    } catch (error) {
      console.error("Error topping up:", error);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackDay || !currentUser || (!feedbackForm.comment.trim() && feedbackForm.rating === 0)) return;

    try {
      await addDoc(collection(db, 'canteen_feedbacks'), {
        userId: currentUser.id,
        userName: `${currentUser.prenom} ${currentUser.nom}`,
        userRole: currentUser.role,
        userClass: currentUser.classe || '',
        day: feedbackDay,
        menuId: feedbackMenuId || 'none',
        rating: feedbackForm.rating,
        comment: feedbackForm.comment.trim(),
        isHealthAlarm: feedbackForm.isHealthAlarm,
        timestamp: serverTimestamp()
      });

      setShowFeedbackModal(false);
      setFeedbackForm({ rating: 5, comment: '', isHealthAlarm: false });
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
  };

  const handleAddRestriction = async () => {
    if (!account || !newRestriction.trim()) return;
    const currentRestrictions = account.restrictions || [];
    if (currentRestrictions.includes(newRestriction.trim())) return;

    try {
      await updateDoc(doc(db, 'canteen_accounts', account.id), {
        restrictions: [...currentRestrictions, newRestriction.trim()]
      });
      setNewRestriction('');
    } catch (error) {
      console.error("Error adding restriction:", error);
    }
  };

  const handleRemoveRestriction = async (index: number) => {
    if (!account || !account.restrictions) return;
    const updated = [...account.restrictions];
    updated.splice(index, 1);

    try {
      await updateDoc(doc(db, 'canteen_accounts', account.id), {
        restrictions: updated
      });
    } catch (error) {
      console.error("Error removing restriction:", error);
    }
  };

  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
              <Utensils size={24} />
            </div>
            {t('canteen')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('canteen_desc')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Canteen Sidebar (Left Column) */}
        <div className="lg:col-span-1 space-y-6">
          {currentUser?.role === 'élève' && (
            <>
              {/* Health Profile Card */}
              <div className="bg-gradient-to-br from-teal-600 to-emerald-700 p-6 rounded-[2.5rem] text-white shadow-xl shadow-teal-100 dark:shadow-none">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                    <AlertTriangle size={24} className="text-white" />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">🩺 Santé & Allergies</p>
                    <p className="text-lg font-black">
                      {account?.restrictions?.length || 0} restriction{(account?.restrictions?.length || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                
                <p className="text-xs text-teal-100 mb-4 leading-relaxed font-semibold">
                  Ajoutez vos allergies ou régimes spécifiques ci-dessous pour alerter les cuisiniers, enseignants et l'administration.
                </p>

                <div className="space-y-3">
                  <div className="max-h-[150px] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                    {account?.restrictions && account.restrictions.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {account.restrictions.map((res, i) => (
                          <span key={i} className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl border border-white/10 flex items-center gap-1.5 transition-colors">
                            {res}
                            <button 
                              onClick={() => handleRemoveRestriction(i)} 
                              className="text-white/80 hover:text-white font-bold text-sm w-4 h-4 flex items-center justify-center rounded-full hover:bg-black/20"
                              title="Retirer cette restriction"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-teal-100/70 italic bg-black/10 p-3 rounded-xl border border-white/5">Aucune allergie ni restriction spécifiée. Ajoutez-en ci-dessous si nécessaire.</p>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2.5">
                    <input 
                      type="text" 
                      value={newRestriction}
                      onChange={(e) => setNewRestriction(e.target.value)}
                      placeholder="Ex: Allergique arachides, diabète..."
                      className="w-full px-4 py-2.5 bg-white/10 border border-white/25 rounded-2xl text-xs placeholder-white/60 text-white outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/15 transition-all font-semibold"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddRestriction()}
                    />
                    <button 
                      onClick={handleAddRestriction}
                      className="w-full py-2.5 bg-white text-teal-800 hover:bg-teal-50 active:bg-teal-100 rounded-2xl text-xs font-black shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>Ajouter la restriction</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Hide top up / refill for students, display Read Only Balance */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400 rounded-xl">
                    <Wallet size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-400">Solde restant</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white">{account?.balance?.toLocaleString() || 0} FCFA</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded-lg">Lecture seule</span>
              </div>

              {/* Recent Reviews Box */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <History size={16} className="text-indigo-600" />
                  Mes avis récents
                </h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {feedbacks.filter(fb => fb.userId === currentUser.id).length > 0 ? (
                    feedbacks.filter(fb => fb.userId === currentUser.id).map((fb) => (
                      <div key={fb.id} className="p-3 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-700 text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-black text-indigo-600">{t(fb.day.toLowerCase())}</span>
                          <span className={`${fb.isHealthAlarm ? 'text-red-600 font-extrabold' : 'text-teal-600 font-semibold'} text-[10px] uppercase`}>
                            {fb.isHealthAlarm ? '⚠️ Alerte' : '🍏 Avis'}
                          </span>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 font-medium">{fb.comment}</p>
                        {fb.rating > 0 && (
                          <div className="flex text-amber-500 font-bold gap-0.5 mt-1">
                            {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 italic">Vous n'avez pas encore laissé d'avis cette semaine.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Parents & Other Non-Students (Refill / Top up enabled) */}
          {(!canManage && currentUser?.role !== 'élève') && (
            <>
              <div className="bg-gradient-to-br from-orange-500 to-pink-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-orange-200 dark:shadow-none">
                <div className="flex justify-between items-start mb-8">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                    <Wallet size={24} />
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black uppercase tracking-widest opacity-80">{t('current_balance')}</p>
                    <p className="text-3xl font-black">{account?.balance.toLocaleString()} FCFA</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <button 
                    onClick={() => setShowTopUp(true)}
                    className="w-full py-4 bg-white text-orange-600 rounded-2xl font-black flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                  >
                    <Plus size={20} />
                    {t('top_up')}
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle size={16} className="text-orange-500" />
                  {t('food_restrictions')}
                </h3>
                {account?.restrictions && account.restrictions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {account.restrictions.map((res, i) => (
                      <span key={i} className="px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg border border-red-100 dark:border-red-800">
                        {res}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">{t('no_restrictions')}</p>
                )}
              </div>
            </>
          )}

          {/* Teachers, Admins, Cooks, Staff: Live Student Feedback & Alerts Board */}
          {(canManage || currentUser?.role === 'enseignant') && (
            <div className="space-y-6">
              {canManage && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-indigo-50 dark:border-indigo-900 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <ChefHat size={18} />
                    </div>
                    <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest leading-none">{t('canteen_management_mode')}</p>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4">
                    {t('canteen_management_desc')}
                  </p>
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                    <div className="flex items-center gap-3">
                      <Info size={18} className="text-indigo-600" />
                      <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                        {t('canteen_draft_notice')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Alert Feed Card */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-red-100 dark:border-red-900/30 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-500 animate-pulse" />
                    Alertes Santé & Avis
                  </h3>
                  <span className="px-2.5 py-1 bg-red-100 dark:bg-red-990 text-red-700 dark:text-red-300 text-[10px] font-black rounded-lg">
                    {feedbacks.filter(f => f.isHealthAlarm).length} Alerte{feedbacks.filter(f => f.isHealthAlarm).length !== 1 ? 's' : ''}
                  </span>
                </div>
                
                <p className="text-[11px] text-gray-400 font-medium leading-normal">
                  Remarques liées aux allergies ou problèmes spécifiques des élèves, permettant d'adapter les repas.
                </p>

                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {feedbacks.length > 0 ? (
                    feedbacks.map((fb) => (
                      <div 
                        key={fb.id} 
                        className={`p-3.5 rounded-2xl border transition-all ${
                          fb.isHealthAlarm 
                            ? 'bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30' 
                            : 'bg-gray-50/50 dark:bg-gray-900/30 border-gray-100 dark:border-gray-800'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-1 pb-1.5 border-b border-gray-100/60 dark:border-gray-800/60 mb-1.5">
                          <div>
                            <p className="font-extrabold text-xs text-gray-900 dark:text-white">{fb.userName}</p>
                            <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">{fb.userClass || 'Classe non spécifiée'}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                            fb.isHealthAlarm 
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-pulse' 
                              : 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400'
                          }`}>
                            {fb.isHealthAlarm ? '🚨 SANTÉ' : '🍏 AVIS'}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">[{t(fb.day.toLowerCase())}]</span> {fb.comment}
                          </p>
                          {fb.rating > 0 && (
                            <div className="flex text-amber-500 text-[10px] font-bold">
                              {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400 text-xs italic">
                      Aucun avis ou alerte de santé n'a été signalé par les élèves.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Weekly Menu */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <Utensils size={24} className="text-indigo-600" />
              {t('weekly_menu')}
            </h2>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <Calendar size={14} />
              {t('week_of')} {new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 
                language === 'en' ? 'en-US' :
                language === 'es' ? 'es-ES' :
                language === 'zh' ? 'zh-CN' : 'ja-JP')}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {days.map((day) => {
              const dayMenu = menu.find(m => m.day === day);
              const isPublished = dayMenu?.published;
              const dayLabel = t(day.toLowerCase());
              
              if (!canManage && !isPublished) {
                return (
                  <div key={day} className="bg-gray-50/50 dark:bg-gray-900/20 p-6 rounded-[2rem] border border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center text-gray-400 gap-2 min-h-[200px]">
                    <Clock size={32} className="opacity-20" />
                    <p className="text-lg font-black">{dayLabel}</p>
                    <p className="text-xs font-bold italic">{t('menu_in_preparation')}</p>
                  </div>
                );
              }

              return (
                <div key={day} className={`bg-white dark:bg-gray-800 p-6 rounded-[2rem] border ${isPublished ? 'border-indigo-100 dark:border-indigo-900' : 'border-gray-100 dark:border-gray-700'} shadow-sm relative overflow-hidden group transition-all`}>
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                    <Utensils size={80} />
                  </div>
                  
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div>
                      <h3 className="text-lg font-black text-indigo-600 dark:text-indigo-400 leading-none">{dayLabel}</h3>
                      {canManage && (
                        <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isPublished ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {isPublished ? t('published_status') : t('draft_status')}
                        </span>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingDay(day);
                            setEditForm(dayMenu || { day, starter: '', mainCourse: '', dessert: '', published: false });
                          }}
                          className="p-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        {dayMenu && (
                          <button 
                            onClick={() => togglePublish(dayMenu)}
                            className={`p-2 rounded-xl transition-colors ${isPublished ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                            title={isPublished ? t('unpublish') : t('publish')}
                          >
                            {isPublished ? <EyeOff size={16} /> : <CheckCircle2 size={16} />}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {dayMenu ? (
                    <div className="space-y-4 relative z-10">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{t('starter')}</p>
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{dayMenu.starter || t('not_defined')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{t('main_course')}</p>
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{dayMenu.mainCourse || t('not_defined')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{t('dessert')}</p>
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{dayMenu.dessert || t('not_defined')}</p>
                      </div>

                      {/* Student Actions: Submit Feedback */}
                      {currentUser?.role === 'élève' && (
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60 flex justify-between items-center bg-transparent">
                          {feedbacks.some(f => f.userId === currentUser.id && f.day === day) ? (
                            <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-2 py-1 rounded-lg border border-teal-100 dark:border-teal-900/40 flex items-center gap-1">
                              <CheckCircle2 size={10} /> Avis soumis
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic font-medium">Pas encore d'avis</span>
                          )}
                          <button 
                            onClick={() => {
                              setFeedbackDay(day);
                              setFeedbackMenuId(dayMenu.id);
                              setShowFeedbackModal(true);
                            }}
                            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 dark:hover:bg-indigo-900/60 rounded-xl text-xs font-black flex items-center gap-1 transition-all hover:scale-105"
                          >
                            <Smile size={14} />
                            Donner mon avis
                          </button>
                        </div>
                      )}

                      {/* Staff & Teachers: Show Feedback stats */}
                      {(canManage || currentUser?.role === 'enseignant') && (
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60 space-y-2">
                          {(() => {
                            const dayFbs = feedbacks.filter(f => f.day === day);
                            const alarms = dayFbs.filter(f => f.isHealthAlarm);
                            if (dayFbs.length === 0) {
                              return <p className="text-[10px] text-gray-400 italic font-medium">Aucun retour élève pour ce repas</p>;
                            }
                            return (
                              <div className="space-y-1">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Avis élèves ({dayFbs.length})</p>
                                <div className="flex flex-wrap gap-1">
                                  <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[9px] font-black rounded-md">
                                    {dayFbs.length - alarms.length} appréciations
                                  </span>
                                  {alarms.length > 0 && (
                                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-[9px] font-black rounded-md animate-pulse">
                                      ⚠️ {alarms.length} Alerte{alarms.length > 1 ? 's' : ''} santé !
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 flex flex-col items-center justify-center text-gray-300 gap-2">
                      <Clock size={32} />
                      <p className="text-xs font-bold italic">{t('not_defined')}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Edit Menu Modal */}
      {editingDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl max-w-lg w-full p-8 border border-white/20"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <Utensils size={24} />
              </div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{t('compose_meal')} : {t(editingDay.toLowerCase())}</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">{t('starter')}</label>
                <input 
                  type="text"
                  value={editForm.starter || ''}
                  onChange={(e) => setEditForm({...editForm, starter: e.target.value})}
                  className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all text-sm font-bold"
                  placeholder="Ex: Salade composée"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">{t('main_course')}</label>
                <input 
                  type="text"
                  value={editForm.mainCourse || ''}
                  onChange={(e) => setEditForm({...editForm, mainCourse: e.target.value})}
                  className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all text-sm font-bold"
                  placeholder="Ex: Poulet rôti et riz"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">{t('dessert')}</label>
                <input 
                  type="text"
                  value={editForm.dessert || ''}
                  onChange={(e) => setEditForm({...editForm, dessert: e.target.value})}
                  className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all text-sm font-bold"
                  placeholder="Ex: Fruit de saison"
                />
              </div>
              <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl cursor-pointer border border-transparent hover:border-indigo-100 transition-all">
                <input 
                  type="checkbox"
                  checked={editForm.published || false}
                  onChange={(e) => setEditForm({...editForm, published: e.target.checked})}
                  className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-white"
                />
                <div>
                  <p className="text-sm font-black text-gray-900 dark:text-white">{t('publish_menu')}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{t('make_visible_students')}</p>
                </div>
              </label>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setEditingDay(null)}
                className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-black"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSaveMenu}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                {t('save')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Top Up Modal */}
      {showTopUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 border border-white/20 text-center"
          >
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Coins size={32} />
            </div>
            
            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-2">{t('top_up_account')}</h2>
            <p className="text-sm text-gray-500 mb-8">{t('top_up_amount_desc')}</p>
            
            <div className="relative mb-8">
              <input 
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                autoFocus
                className="w-full text-4xl font-black text-center bg-gray-50 dark:bg-gray-900 border-none rounded-3xl py-6 focus:ring-4 focus:ring-orange-500/20 outline-none"
                placeholder="0"
              />
              <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xl font-black text-gray-300">FCFA</span>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setShowTopUp(false)}
                className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-black"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleTopUp}
                className="flex-1 py-4 bg-orange-600 text-white rounded-2xl font-black shadow-lg shadow-orange-200 dark:shadow-none hover:scale-105 transition-all"
              >
                {t('confirm')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Leave Feedback Modal */}
      {showFeedbackModal && feedbackDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl max-w-lg w-full p-8 border border-white/20"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <Smile size={24} />
              </div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Avis sur le menu : {t(feedbackDay.toLowerCase())}</h2>
            </div>
            
            <div className="space-y-6">
              {/* Star Rating Section */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Note globale</label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button 
                      key={star}
                      onClick={() => setFeedbackForm({...feedbackForm, rating: star})}
                      className="text-2xl transition-all active:scale-90"
                    >
                      <Star 
                        size={32} 
                        className={star <= feedbackForm.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment Text Box */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Vos remarques / commentaires</label>
                <textarea 
                  value={feedbackForm.comment}
                  onChange={(e) => setFeedbackForm({...feedbackForm, comment: e.target.value})}
                  rows={4}
                  required
                  placeholder="Ex: Trop épicé, ce plat contient des arachides, etc."
                  className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all text-sm font-bold resize-none"
                />
              </div>

              {/* Health Alarm Toggle */}
              <label className="flex items-start gap-3 p-4 bg-red-50/50 dark:bg-red-950/20 rounded-2xl cursor-pointer border border-transparent hover:border-red-100 transition-all select-none">
                <input 
                  type="checkbox"
                  checked={feedbackForm.isHealthAlarm}
                  onChange={(e) => setFeedbackForm({...feedbackForm, isHealthAlarm: e.target.checked})}
                  className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 bg-white mt-0.5"
                />
                <div>
                  <p className="text-sm font-black text-red-800 dark:text-red-300 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-red-600" />
                    Signaler un problème de santé / allergie
                  </p>
                  <p className="text-[10px] text-red-600/70 font-bold uppercase tracking-widest mt-0.5">Note importante visible par les enseignants et l'administration</p>
                </div>
              </label>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => {
                  setShowFeedbackModal(false);
                  setFeedbackForm({ rating: 5, comment: '', isHealthAlarm: false });
                }}
                className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-black"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSubmitFeedback}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                Soumettre l'avis
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
