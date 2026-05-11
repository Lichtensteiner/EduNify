import React, { useState, useEffect } from 'react';
import { 
  Utensils, 
  ShoppingCart, 
  Calendar, 
  Users, 
  ClipboardList, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Plus,
  Search,
  ChevronRight,
  TrendingUp,
  Beef,
  Apple,
  Coffee,
  Trash2,
  Edit2,
  Package,
  ArrowRight,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, limit, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { recordAuditLog } from '../services/auditService';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function CanteenDashboard() {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [meals, setMeals] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [editingMeal, setEditingMeal] = useState<any>(null);
  
  const [newMeal, setNewMeal] = useState({
    title: '',
    description: '',
    type: 'déjeuner',
    targetDate: new Date().toISOString().split('T')[0],
    calories: ''
  });

  const [newStockItem, setNewStockItem] = useState({
    name: '',
    quantity: '',
    unit: 'kg',
    category: 'Epicerie',
    minThreshold: '5'
  });

  useEffect(() => {
    // Listen to meals/menus
    const unsubMeals = onSnapshot(
      query(collection(db, 'canteen_menus'), orderBy('targetDate', 'desc'), limit(20)),
      (snapshot) => {
        setMeals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }
    );

    // Listen to stock/inventory
    const unsubStock = onSnapshot(collection(db, 'canteen_stock'), (snapshot) => {
      setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubMeals();
      unsubStock();
    };
  }, []);

  const handleAddMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMeal) {
        await updateDoc(doc(db, 'canteen_menus', editingMeal.id), {
          ...newMeal,
          updatedAt: serverTimestamp()
        });
        await recordAuditLog({
          userId: currentUser?.id || 'chef',
          userName: `${currentUser?.prenom} ${currentUser?.nom}`,
          userRole: currentUser?.role || 'cuisinier',
          action: "Mise à jour de menu",
          details: `Menu mis à jour: ${newMeal.title}`,
          category: 'canteen'
        });
      } else {
        await addDoc(collection(db, 'canteen_menus'), {
          ...newMeal,
          createdAt: serverTimestamp(),
          createdBy: currentUser?.id,
          chefName: `${currentUser?.prenom} ${currentUser?.nom}`
        });
        await recordAuditLog({
          userId: currentUser?.id || 'chef',
          userName: `${currentUser?.prenom} ${currentUser?.nom}`,
          userRole: currentUser?.role || 'cuisinier',
          action: "Création de menu",
          details: `Nouveau menu: ${newMeal.title} pour le ${newMeal.targetDate}`,
          category: 'canteen'
        });
      }
      setShowAddMenu(false);
      setEditingMeal(null);
      setNewMeal({ title: '', description: '', type: 'déjeuner', targetDate: new Date().toISOString().split('T')[0], calories: '' });
    } catch (error) {
      console.error("Error saving meal:", error);
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'canteen_stock'), {
        ...newStockItem,
        quantity: parseFloat(newStockItem.quantity),
        minThreshold: parseFloat(newStockItem.minThreshold),
        updatedAt: serverTimestamp()
      });
      await recordAuditLog({
        userId: currentUser?.id || 'chef',
        userName: `${currentUser?.prenom} ${currentUser?.nom}`,
        userRole: currentUser?.role || 'cuisinier',
        action: "Ajout de stock",
        details: `Article ajouté: ${newStockItem.name} (${newStockItem.quantity}${newStockItem.unit})`,
        category: 'canteen'
      });
      setShowAddStock(false);
      setNewStockItem({ name: '', quantity: '', unit: 'kg', category: 'Epicerie', minThreshold: '5' });
    } catch (error) {
      console.error("Error adding stock:", error);
    }
  };

  const deleteMeal = async (id: string, title: string) => {
    if (!window.confirm("Supprimer ce menu ?")) return;
    try {
      await deleteDoc(doc(db, 'canteen_menus', id));
      await recordAuditLog({
        userId: currentUser?.id || 'chef',
        userName: `${currentUser?.prenom} ${currentUser?.nom}`,
        userRole: currentUser?.role || 'cuisinier',
        action: "Suppression de menu",
        details: `Menu supprimé: ${title}`,
        category: 'canteen'
      });
    } catch (error) {
      console.error("Error deleting meal:", error);
    }
  };

  const deleteStock = async (id: string, name: string) => {
    if (!window.confirm("Supprimer cet article du stock ?")) return;
    try {
      await deleteDoc(doc(db, 'canteen_stock', id));
    } catch (error) {
      console.error("Error deleting stock:", error);
    }
  };

  // Derive stats
  const alertCount = stock.filter(item => (item.quantity || 0) <= (item.minThreshold || 0)).length;
  const categories = Array.from(new Set(stock.map(s => s.category || 'Inconnu')));
  const stockStats = categories.map(cat => ({
    name: cat,
    value: stock.filter(s => s.category === cat).length
  }));

  const menuForToday = meals.find(m => m.targetDate === new Date().toISOString().split('T')[0]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-rose-600 outline outline-offset-4 outline-rose-100 rounded-2xl shadow-xl shadow-rose-200">
              <Utensils size={28} className="text-white" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight italic">
              Gestion Cantine
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium max-w-xl">
            Coordonnez la chaîne de restauration, suivez les stocks en temps réel et planifiez les apports nutritionnels.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => {
              setEditingMeal(null);
              setNewMeal({ title: '', description: '', type: 'déjeuner', targetDate: new Date().toISOString().split('T')[0], calories: '' });
              setShowAddMenu(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-6 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-rose-100 hover:scale-[1.02] active:scale-95 group"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform" />
            Nouveau Menu
          </button>
          <button 
            onClick={() => setShowAddStock(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-emerald-100 hover:scale-[1.02] active:scale-95"
          >
            <ShoppingCart size={20} />
            Ajouter au Stock
          </button>
        </div>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Menu du jour', val: menuForToday?.title || 'Non défini', icon: Utensils, color: 'rose', trend: menuForToday?.calories + ' kcal' },
          { label: 'Alertes Stock', val: alertCount, icon: AlertCircle, color: 'amber', trend: alertCount > 0 ? 'Réapprovisionnement nécessaire' : 'Stock optimal', warning: alertCount > 0 },
          { label: 'Articles suivis', val: stock.length, icon: Package, color: 'indigo', trend: categories.length + ' catégories' },
          { label: 'Participation', val: '450', icon: Users, color: 'sky', trend: '+12% vs hier' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`p-6 rounded-[2rem] border bg-white dark:bg-gray-800 flex flex-col justify-between h-40 ${
              stat.warning ? 'border-amber-200 bg-amber-50/30' : 'border-gray-50 dark:border-gray-700 shadow-sm'
            }`}
          >
            <div className="flex justify-between items-start">
              <div className={`p-2.5 rounded-xl bg-${stat.color}-50 text-${stat.color}-600 dark:bg-${stat.color}-900/30 dark:text-${stat.color}-400`}>
                <stat.icon size={22} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${stat.warning ? 'text-amber-600' : 'text-gray-400'}`}>
                {stat.label}
              </span>
            </div>
            <div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white truncate">{stat.val}</h3>
              <p className={`text-[10px] font-bold ${stat.warning ? 'text-amber-600' : 'text-gray-400'} mt-1 truncate`}>
                {stat.trend}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Real-time Menu Manager */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-[3rem] border border-gray-100 dark:border-gray-700 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                  <Calendar className="text-rose-600" size={24} />
                  Planning Pédagogique Nutritionnel
                </h3>
                <p className="text-xs text-gray-400 font-medium mt-1">Les 20 prochains repas configurés</p>
              </div>
              <div className="hidden sm:flex bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700">
                <button className="px-5 py-2 text-[10px] font-black uppercase tracking-widest bg-white dark:bg-gray-800 shadow-sm rounded-xl text-rose-600">Hebdomadaire</button>
                <button className="px-5 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors">Mensuel</button>
              </div>
            </div>

            <div className="grid gap-4">
              <AnimatePresence mode="popLayout">
                {meals.map((meal) => (
                  <motion.div
                    key={meal.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="group relative flex items-center gap-6 p-5 rounded-3xl border border-gray-50 dark:border-gray-700/50 hover:border-rose-200 dark:hover:border-rose-900/30 hover:bg-rose-50/10 dark:hover:bg-rose-900/5 transition-all"
                  >
                    <div className="w-20 h-20 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex flex-col items-center justify-center text-rose-600 shrink-0 border border-rose-100 dark:border-rose-900/30">
                      <span className="text-[10px] font-black uppercase tracking-widest mb-1">{new Date(meal.targetDate).toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                      <span className="text-2xl font-black tracking-tighter">{new Date(meal.targetDate).getDate()}</span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <span className={`px-4 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                          meal.type === 'petit-déjeuner' ? 'bg-amber-100 text-amber-700' :
                          meal.type === 'déjeuner' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {meal.type}
                        </span>
                        {meal.targetDate === new Date().toISOString().split('T')[0] && (
                          <span className="text-[10px] font-bold text-emerald-500 uppercase flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Aujourd'hui
                          </span>
                        )}
                      </div>
                      <h4 className="text-lg font-black text-gray-900 dark:text-white truncate italic tracking-tight">{meal.title}</h4>
                      <p className="text-sm text-gray-500 line-clamp-1 font-medium">{meal.description}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right hidden md:block mr-4">
                        <p className="text-sm font-black text-gray-900 dark:text-white">{meal.calories || '0'} kcal</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Énergie</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button 
                          onClick={() => {
                            setEditingMeal(meal);
                            setNewMeal({
                              title: meal.title,
                              description: meal.description,
                              type: meal.type,
                              targetDate: meal.targetDate,
                              calories: meal.calories || ''
                            });
                            setShowAddMenu(true);
                          }}
                          className="p-2 text-gray-400 hover:text-rose-600 transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => deleteMeal(meal.id, meal.title)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {meals.length === 0 && !loading && (
                <div className="py-20 flex flex-col items-center justify-center text-center opacity-50">
                  <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-full mb-4">
                    <Utensils size={40} className="text-gray-300" />
                  </div>
                  <h4 className="text-lg font-black italic tracking-tight">Aucun menu planifié</h4>
                  <p className="text-sm font-medium">Commencez par planifier vos apports nutritionnels.</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Dynamic Charts Integration */}
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-black text-gray-900 dark:text-white italic tracking-tight">Analyse de Charge</h3>
                <TrendingUp size={20} className="text-emerald-500" />
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { day: 'Lun', qty: 420 },
                    { day: 'Mar', qty: 445 },
                    { day: 'Mer', qty: 310 },
                    { day: 'Jeu', qty: 430 },
                    { day: 'Ven', qty: 395 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                    <Tooltip cursor={{ fill: '#fef2f2' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="qty" fill="#e11d48" radius={[6, 6, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Critical Stock List */}
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-gray-900 dark:text-white italic tracking-tight">Stocks Critiques</h3>
                <AlertCircle size={20} className="text-amber-500" />
              </div>
              <div className="space-y-4">
                {stock.filter(s => s.quantity <= s.minThreshold).slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-50 dark:border-amber-900/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600">
                        <Package size={14} />
                      </div>
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-red-500">{item.quantity} {item.unit}</p>
                      <p className="text-[10px] font-bold text-gray-400">Restant</p>
                    </div>
                  </div>
                ))}
                {alertCount === 0 && (
                  <div className="py-8 text-center text-gray-400 text-xs font-medium">
                    <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-100" />
                    Pas d'alertes critiques pour le moment.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Real Inventory Sidebar */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-black text-gray-900 dark:text-white italic tracking-tight mb-8">Catégories de Stock</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockStats.length > 0 ? stockStats : [{name: 'Vide', value: 1}]}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {stockStats.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    {stockStats.length === 0 && <Cell fill="#f3f4f6" />}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-8 space-y-3">
              {stockStats.map((stat, idx) => (
                <div key={stat.name} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{stat.name}</span>
                  </div>
                  <span className="text-xs font-black text-gray-900 dark:text-white">{stat.value} articles</span>
                </div>
              ))}
            </div>
          </div>

          {/* Full Stock List Quick Access */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-sm">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-gray-900 dark:text-white italic tracking-tight">Répertoire Complet</h3>
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl"><Filter size={16} /></div>
             </div>
             <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {stock.length > 0 ? stock.map(item => (
                  <div key={item.id} className="group relative p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-indigo-100 transition-all">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">{item.category}</span>
                       <button onClick={() => deleteStock(item.id, item.name)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all">
                          <Trash2 size={12} />
                       </button>
                    </div>
                    <h5 className="text-sm font-black text-gray-900 dark:text-white mb-1">{item.name}</h5>
                    <div className="flex justify-between items-end">
                       <p className="text-xs font-bold text-gray-400">{item.quantity} {item.unit}</p>
                       <div className="h-1 w-12 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full ${item.quantity <= item.minThreshold ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, (item.quantity / (item.minThreshold * 3)) * 100)}%` }} />
                       </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-12 text-gray-400 text-[10px] font-black uppercase tracking-widest bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-100">
                    Aucun article en stock
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Meals Modal */}
      <AnimatePresence>
        {showAddMenu && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowAddMenu(false); setEditingMeal(null); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl max-w-lg w-full p-10 border border-white/20 relative z-10"
            >
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight italic mb-8">
                {editingMeal ? 'Ajuster le Menu' : 'Nouveau Menu'}
              </h2>
              <form onSubmit={handleAddMeal} className="space-y-6">
                <div className="relative">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Désignation du Plat</label>
                  <input 
                    type="text" required value={newMeal.title}
                    onChange={(e) => setNewMeal({...newMeal, title: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-6 py-4 font-bold focus:ring-4 focus:ring-rose-500/20 outline-none"
                    placeholder="ex: Riz à la Sauce Graine et Banane Plantain"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {['petit-déjeuner', 'déjeuner', 'dîner'].map(type => (
                    <button
                      key={type} type="button"
                      onClick={() => setNewMeal({...newMeal, type})}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                        newMeal.type === type ? 'border-rose-600 bg-rose-50 dark:bg-rose-900/30 text-rose-700' : 'border-gray-50 text-gray-400'
                      }`}
                    >
                      {type === 'petit-déjeuner' ? <Coffee size={20} /> : type === 'déjeuner' ? <Beef size={20} /> : <Utensils size={20} />}
                      <span className="text-[8px] font-black uppercase tracking-widest">{type}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Date</label>
                    <input 
                      type="date" required value={newMeal.targetDate}
                      onChange={(e) => setNewMeal({...newMeal, targetDate: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-6 py-4 font-bold text-sm focus:ring-4 focus:ring-rose-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Calories (estimé)</label>
                    <input 
                      type="number" value={newMeal.calories}
                      onChange={(e) => setNewMeal({...newMeal, calories: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-6 py-4 font-bold text-sm focus:ring-4 focus:ring-rose-500/20 outline-none"
                      placeholder="kcal"
                    />
                  </div>
                </div>

                <textarea 
                  rows={3} value={newMeal.description}
                  onChange={(e) => setNewMeal({...newMeal, description: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-6 py-4 font-medium text-sm focus:ring-4 focus:ring-rose-500/20 outline-none resize-none"
                  placeholder="Notes culinaires ou allergènes..."
                />

                <button 
                  type="submit"
                  className="w-full py-5 bg-rose-600 text-white rounded-[2rem] font-black shadow-xl shadow-rose-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98] transition-all text-xl"
                >
                  {editingMeal ? 'Enregistrer les modifications' : 'Lancer le Menu'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Modal */}
      <AnimatePresence>
        {showAddStock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddStock(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl max-w-lg w-full p-10 border border-white/20 relative z-10"
            >
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight italic mb-8">Nouveau Ravitaillement</h2>
              <form onSubmit={handleAddStock} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Nom de l'ingrédient</label>
                  <input 
                    type="text" required value={newStockItem.name}
                    onChange={(e) => setNewStockItem({...newStockItem, name: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-6 py-4 font-bold focus:ring-4 focus:ring-emerald-500/20 outline-none"
                    placeholder="ex: Huile Végétale"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Quantité Initiale</label>
                    <div className="flex gap-2">
                       <input 
                        type="number" required value={newStockItem.quantity}
                        onChange={(e) => setNewStockItem({...newStockItem, quantity: e.target.value})}
                        className="flex-1 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-6 py-4 font-bold focus:ring-4 focus:ring-emerald-500/20 outline-none"
                      />
                      <select 
                        value={newStockItem.unit}
                        onChange={(e) => setNewStockItem({...newStockItem, unit: e.target.value})}
                        className="w-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 font-black rounded-2xl px-2 outline-none border-none text-xs"
                      >
                        <option value="kg">kg</option>
                        <option value="L">L</option>
                        <option value="pcs">pcs</option>
                        <option value="sac">sac</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Seuil Alerte</label>
                    <input 
                      type="number" value={newStockItem.minThreshold}
                      onChange={(e) => setNewStockItem({...newStockItem, minThreshold: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-6 py-4 font-bold focus:ring-4 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Catégorie</label>
                  <select 
                    value={newStockItem.category}
                    onChange={(e) => setNewStockItem({...newStockItem, category: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-6 py-4 font-bold focus:ring-4 focus:ring-emerald-500/20 outline-none"
                  >
                    <option value="Fruits/Légumes">Fruits & Légumes</option>
                    <option value="Viandes/Poissons">Viandes & Poissons</option>
                    <option value="Produits Laitiers">Produits Laitiers</option>
                    <option value="Epicerie">Epicerie Sèche</option>
                    <option value="Boissons">Boissons</option>
                    <option value="Autres">Autres</option>
                  </select>
                </div>

                <button 
                  type="submit"
                  className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black shadow-xl shadow-emerald-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98] transition-all text-xl"
                >
                  Entrer en Stock
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
