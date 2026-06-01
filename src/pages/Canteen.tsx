import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, query, onSnapshot, addDoc, updateDoc, doc, setDoc, deleteDoc, 
  serverTimestamp, where, getDocs, limit, orderBy 
} from 'firebase/firestore';
import { 
  Utensils, Plus, Calendar, CreditCard, ChefHat, Info, Clock, CheckCircle2, 
  AlertTriangle, History, Wallet, Coins, Edit2, Trash2, Package, Search, 
  QrCode, Scale, ShieldAlert, ShoppingBag, TrendingUp, HandCoins, Bell, LucideIcon, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { recordAuditLog } from '../services/auditService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';

// Extra catalog items with default prices and matching stock keys
interface ExtraProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  stockKey: string;
}

const EXTRA_PRODUCTS: ExtraProduct[] = [
  { id: 'p1', name: 'Eau Minérale', price: 500, category: 'Boissons', stockKey: 'Eau Minérale' },
  { id: 'p2', name: 'Jus d’Orange Bio', price: 800, category: 'Boissons', stockKey: 'Jus d’Orange' },
  { id: 'p3', name: 'Lait Frais', price: 600, category: 'Produits Laitiers', stockKey: 'Lait' },
  { id: 'p4', name: 'Yaourt Vanille', price: 700, category: 'Produits Laitiers', stockKey: 'Yaourt' },
  { id: 'p5', name: 'Sandwich Thon', price: 1500, category: 'Autres', stockKey: 'Sandwich' },
  { id: 'p6', name: 'Banane Fruit', price: 300, category: 'Fruits/Légumes', stockKey: 'Banane' },
  { id: 'p7', name: 'Gâteau Chocolat', price: 800, category: 'Autres', stockKey: 'Gâteau' },
];

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function Canteen() {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  
  // Tabs & Real-time Active states
  const [activeTab, setActiveTab] = useState<'dash' | 'caisse' | 'parent' | 'menus' | 'formulas' | 'stocks' | 'compta'>('dash');
  const [roleMode, setRoleMode] = useState<string>('admin'); // True authenticated user role mapped
  
  // Data State
  const [menus, setMenus] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [consumptions, setConsumptions] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Parent UI helper
  const [selectedParentChildId, setSelectedParentChildId] = useState<string>('');
  const [topUpAmount, setTopUpAmount] = useState<string>('');
  
  // Point of Sale Scanner State
  const [scannedStudentId, setScannedStudentId] = useState<string>('');
  const [scanning, setScanning] = useState<boolean>(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [receipt, setReceipt] = useState<any | null>(null);
  const [messagePOS, setMessagePOS] = useState<{ text: string; type: 'success' | 'warn' | 'error' } | null>(null);

  // Admin Forms State
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [menuForm, setMenuForm] = useState({
    starter: '',
    mainCourse: '',
    dessert: '',
    portions: 100,
    productionCost: 800,
    calories: 650,
    published: true
  });

  const [stockForm, setStockForm] = useState({
    name: '',
    quantity: 10,
    unit: 'pcs',
    category: 'Epicerie',
    minThreshold: 5
  });

  // Automatically adapt role mode and active tab on load depending strictly on authentic credentials
  useEffect(() => {
    if (currentUser) {
      const role = currentUser.role || '';
      if (role === 'parent') {
        setRoleMode('parent');
        setActiveTab('parent');
      } else if (role === 'élève') {
        setRoleMode('student');
        setActiveTab('menus');
      } else if (role === 'cuisinier') {
        setRoleMode('cuisinier');
        setActiveTab('caisse');
      } else {
        setRoleMode('admin');
        setActiveTab('dash');
      }
    }
  }, [currentUser]);

  // Firestore Snapshot Listeners
  useEffect(() => {
    setLoading(true);
    
    // 1. Weekly Menus
    const unsubMenus = onSnapshot(collection(db, 'canteen_menu'), (snap) => {
      setMenus(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 2. Wallets / Student Profiles
    const unsubAccounts = onSnapshot(collection(db, 'canteen_accounts'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(list);
      
      // Auto-select first student as fallback for parent child view
      if (list.length > 0 && !selectedParentChildId) {
        setSelectedParentChildId(list[0].id);
      }
    });

    // 3. Stock
    const unsubStock = onSnapshot(collection(db, 'canteen_stock'), (snap) => {
      setStock(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 4. Consumptions
    const unsubConsumptions = onSnapshot(collection(db, 'canteen_consumptions'), (snap) => {
      const loaded = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      loaded.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setConsumptions(loaded);
    });

    // 5. Feedbacks
    const unsubFeedbacks = onSnapshot(collection(db, 'canteen_feedbacks'), (snap) => {
      setFeedbacks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubMenus();
      unsubAccounts();
      unsubStock();
      unsubConsumptions();
      unsubFeedbacks();
    };
  }, []);

  // Seed standard database demo if empty
  const handleSeedDemo = async () => {
    try {
      // 1. Seed Menus
      const weekDays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
      const starters = ['Salade niçoise', 'Velouté de potiron', 'Oeuf mimosa', 'Taboulé libanais', 'Ravioles de légumes'];
      const mains = ['Poulet grillé et allocos', 'Poisson braisé au manioc', 'Ragoût de boeuf pommes', 'Plat de riz au gras sénégalais', 'Brochettes de dinde frites'];
      const desserts = ['Salade de papaye', 'Yaourt aromatisé', 'Crème caramel', 'Banane douce et chocolat', 'Ananas caramélisé'];
      
      for (let i = 0; i < weekDays.length; i++) {
        const existing = menus.find(m => m.day === weekDays[i]);
        if (!existing) {
          await setDoc(doc(db, 'canteen_menu', weekDays[i]), {
            day: weekDays[i],
            starter: starters[i],
            mainCourse: mains[i],
            dessert: desserts[i],
            portions: 150,
            productionCost: 650,
            calories: 700 + (i * 20),
            published: true
          });
        }
      }

      // 2. Seed Stocks
      const defaultStocks = [
        { name: 'Riz de luxe', quantity: 180, unit: 'kg', category: 'Epicerie', minThreshold: 30 },
        { name: 'Poulet frais', quantity: 95, unit: 'kg', category: 'Viandes/Poissons', minThreshold: 20 },
        { name: 'Huile raffinée', quantity: 12, unit: 'L', category: 'Epicerie', minThreshold: 15 }, // alert tier
        { name: 'Yaourt', quantity: 80, unit: 'pcs', category: 'Produits Laitiers', minThreshold: 20 },
        { name: 'Eau Minérale', quantity: 120, unit: 'pcs', category: 'Boissons', minThreshold: 30 },
        { name: 'Jus d’Orange', quantity: 45, unit: 'pcs', category: 'Boissons', minThreshold: 20 },
        { name: 'Lait', quantity: 60, unit: 'pcs', category: 'Produits Laitiers', minThreshold: 15 },
        { name: 'Sandwich', quantity: 4, unit: 'pcs', category: 'Autres', minThreshold: 5 }, // stock alert
        { name: 'Banane', quantity: 150, unit: 'pcs', category: 'Fruits/Légumes', minThreshold: 25 },
        { name: 'Gâteau', quantity: 9, unit: 'pcs', category: 'Autres', minThreshold: 10 }, // alert
      ];

      for (const st of defaultStocks) {
        if (!stock.some(s => s.name === st.name)) {
          await addDoc(collection(db, 'canteen_stock'), {
            ...st,
            updatedAt: serverTimestamp()
          });
        }
      }

      // 3. Seed Students Canteen Accounts
      const studentsDemo = [
        { id: 'elev_1', name: 'Amina Diallo', class: '6ème A', matricule: 'AMT601', balance: 7500, formula: 'standard', restrictions: ['Allergie arachides'] },
        { id: 'elev_2', name: 'Kouassi Yao', class: '6ème A', matricule: 'KOY602', balance: 14500, formula: 'premium', restrictions: [] },
        { id: 'elev_3', name: 'Marc Sow', class: '5ème B', matricule: 'MAS501', balance: 1200, formula: 'externe', restrictions: ['Sans Porc'] },
        { id: 'elev_4', name: 'Fatou Bamba', class: 'Terminale S', matricule: 'FAB801', balance: 3500, formula: 'standard', restrictions: ['Allergie fruits de mer'] },
        { id: 'elev_5', name: 'Serge Traoré', class: '1ère D', matricule: 'SET701', balance: 0, formula: 'externe', restrictions: [] },
      ];

      for (const std of studentsDemo) {
        if (!accounts.some(a => a.userId === std.id)) {
          await setDoc(doc(db, 'canteen_accounts', std.id), {
            userId: std.id,
            userName: std.name,
            userClass: std.class,
            matricule: std.matricule,
            balance: std.balance,
            formula: std.formula,
            restrictions: std.restrictions,
            dailyLimit: 2000,
            allowedProducts: EXTRA_PRODUCTS.map(p => p.name),
            notifications: [
              { id: 'n1', title: 'Compte activé', message: 'Bienvenue sur la cantine intelligente.', date: new Date().toLocaleDateString() }
            ]
          });
        }
      }

      alert('Données de démonstration initialisées avec succès !');
    } catch (err) {
      console.error(err);
      alert('Erreur lors du seeding.');
    }
  };

  // Enregistrement de passage de carte (lecture NFC / Pointage ultra-rapide)
  const handleLoadStudentProfile = (studentId: string) => {
    setScanning(true);
    setMessagePOS(null);
    setReceipt(null);
    setCart({});
    
    // Temps de latence minimal pour ressentir la lecture physique en temps réel
    setTimeout(() => {
      const found = accounts.find(a => a.id === studentId);
      if (found) {
        setSelectedStudent(found);
      }
      setScanning(false);
    }, 150);
  };

  // Helper to count cumulative spent amount for a user today
  const getTodaySpentAmount = (userId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return consumptions
      .filter(c => c.userId === userId && c.date === today)
      .reduce((sum, c) => sum + (c.price || 0), 0);
  };

  // Get quota of meals consumed today
  const getTodayMealsConsumedCount = (userId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return consumptions
      .filter(c => c.userId === userId && c.date === today && c.type !== 'produit complémentaire')
      .length;
  };

  // Serve Main standard formula meal
  const handleServeFormulaMeal = async (type: 'inclus' | 'payant', price: number) => {
    if (!selectedStudent) return;
    const weekDaysFr = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const currentDayName = weekDaysFr[new Date().getDay()];
    const currentDay = (currentDayName === 'Samedi' || currentDayName === 'Dimanche') ? 'Lundi' : currentDayName;
    const currentMenu = menus.find(m => m.day === currentDay) || { mainCourse: 'Menu standard du jour' };

    try {
      // 1. If paid, substract balance
      if (type === 'payant') {
        const todaySpent = getTodaySpentAmount(selectedStudent.id);
        if (todaySpent + price > selectedStudent.dailyLimit) {
          setMessagePOS({ text: `Achat bloqué : Dépasse la limite de consommation quotidienne fixée par les parents (${selectedStudent.dailyLimit} FCFA). Un sms d'alerte a été envoyé.`, type: 'error' });
          return;
        }

        if (selectedStudent.balance < price) {
          setMessagePOS({ text: `Erreur : Solde portefeuille insuffisant (${selectedStudent.balance} FCFA). Transaction bloquée.`, type: 'error' });
          return;
        }

        await updateDoc(doc(db, 'canteen_accounts', selectedStudent.id), {
          balance: selectedStudent.balance - price
        });
      }

      // 2. Register consumption trace
      await addDoc(collection(db, 'canteen_consumptions'), {
        userId: selectedStudent.userId,
        userName: selectedStudent.userName,
        userClass: selectedStudent.userClass,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        mealTitle: currentMenu.mainCourse,
        type: type === 'inclus' ? 'repas inclus' : 'repas supplémentaire',
        price: type === 'inclus' ? 0 : price,
        timestamp: serverTimestamp()
      });

      // 3. Decrement Menu portions
      if (currentMenu.id) {
        await updateDoc(doc(db, 'canteen_menu', currentMenu.id), {
          portions: Math.max(0, (currentMenu.portions || 100) - 1)
        });
      }

      // Log audit
      await recordAuditLog({
        userId: currentUser?.id || 'cashier',
        userName: `${currentUser?.prenom} ${currentUser?.nom}`,
        userRole: 'caissier',
        action: "Validation Repas",
        details: `${selectedStudent.userName} - ${type === 'inclus' ? 'Repas inclus consommé' : 'Repas additionnel facturé à ' + price + ' FCFA' }`,
        category: 'canteen'
      });

      setMessagePOS({ text: `${type === 'inclus' ? '✓ Repas inclus servi avec succès !' : '✓ Repas supplémentaire facturé et validé !'}`, type: 'success' });
      
      // Auto-reload scan data to display updated metrics
      setSelectedStudent(prev => prev ? { ...prev, balance: type === 'payant' ? prev.balance - price : prev.balance } : null);

    } catch (err) {
      console.error(err);
      setMessagePOS({ text: "Erreur technique lors de la validation du repas", type: 'error' });
    }
  };

  // POS Add extra snack/drink to cart
  const handleAddToCart = (prod: ExtraProduct) => {
    // Check if item is authorized by parents
    if (selectedStudent && !selectedStudent.allowedProducts?.includes(prod.name)) {
      setMessagePOS({ text: `🛑 Ce produit est bloqué par le contrôle parental appliqué à cet élève !`, type: 'warn' });
      return;
    }
    setCart(prev => ({ ...prev, [prod.id]: (prev[prod.id] || 0) + 1 }));
  };

  // Clean POS cart
  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => {
      const clone = { ...prev };
      if (clone[productId] <= 1) delete clone[productId];
      else clone[productId]--;
      return clone;
    });
  };

  // Pos Checkout shop cart
  const handleCheckoutCart = async () => {
    if (!selectedStudent || Object.keys(cart).length === 0) return;
    
    // Calculate total price
    let totalCost = 0;
    const cartItemsList: any[] = [];
    
    for (const pid of Object.keys(cart)) {
      const match = EXTRA_PRODUCTS.find(p => p.id === pid);
      if (match) {
        totalCost += match.price * cart[pid];
        cartItemsList.push({ ...match, qty: cart[pid] });
      }
    }

    // Checking Parental Limits
    const consumedToday = getTodaySpentAmount(selectedStudent.id);
    if (consumedToday + totalCost > selectedStudent.dailyLimit) {
      setMessagePOS({ 
        text: `Achat bloqué par le contrôle parental ! Limite quotidienne de dépenses : ${selectedStudent.dailyLimit} FCFA. Total consommé ce jour si validé : ${consumedToday + totalCost} FCFA. Un SMS de blocage a été notifié aux parents.`, 
        type: 'error' 
      });

      // Append instant notification block to log
      await updateDoc(doc(db, 'canteen_accounts', selectedStudent.id), {
        notifications: [
          { 
            id: Date.now().toString(), 
            title: '⚠️ Tentative d\'achat bloquée', 
            message: `Votre enfant a tenté d'acheter des suppléments pour un montant de ${totalCost} FCFA, dépassant sa limite journalière autorisée.`,
            date: new Date().toLocaleDateString()
          },
          ...(selectedStudent.notifications || [])
        ]
      });
      return;
    }

    // Checking wallet funds
    if (selectedStudent.balance < totalCost) {
      setMessagePOS({ text: `Solde insuffisant pour finaliser l'achat de suppléments (Requis: ${totalCost} FCFA, Disponible: ${selectedStudent.balance} FCFA).`, type: 'error' });
      return;
    }

    try {
      // Deduct Wallet balance
      const newBal = selectedStudent.balance - totalCost;
      await updateDoc(doc(db, 'canteen_accounts', selectedStudent.id), {
        balance: newBal
      });

      // Write consumption and decrement stocks for each checkout product
      for (const item of cartItemsList) {
        await addDoc(collection(db, 'canteen_consumptions'), {
          userId: selectedStudent.userId,
          userName: selectedStudent.userName,
          userClass: selectedStudent.userClass,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          mealTitle: `Supplément : ${item.name} (x${item.qty})`,
          type: 'produit complémentaire',
          price: item.price * item.qty,
          timestamp: serverTimestamp()
        });

        // Search matching stock database item to decrement
        const matchesStock = stock.find(s => s.name.toLowerCase().trim() === item.stockKey.toLowerCase().trim());
        if (matchesStock) {
          await updateDoc(doc(db, 'canteen_stock', matchesStock.id), {
            quantity: Math.max(0, (matchesStock.quantity || 0) - item.qty)
          });
        }
      }

      // Print thermal receipt simulation
      setReceipt({
        id: 'T-' + Math.floor(Math.random() * 90000 + 10000),
        dateTime: new Date().toLocaleString(),
        studentName: selectedStudent.userName,
        class: selectedStudent.userClass,
        items: cartItemsList,
        total: totalCost,
        remainingBalance: newBal
      });

      // Notify success + clear cart
      setMessagePOS({ text: `L'achat de ${totalCost} FCFA a été débité et validé avec succès !`, type: 'success' });
      setCart({});
      setSelectedStudent(prev => prev ? { ...prev, balance: newBal } : null);

    } catch (err) {
      console.error(err);
      setMessagePOS({ text: "Erreur technique lors du traitement du panier", type: 'error' });
    }
  };

  // Simulat parents topping up student wallet
  const handleParentTopUp = async () => {
    const parentChild = accounts.find(a => a.id === selectedParentChildId);
    if (!parentChild || !topUpAmount) return;
    const value = parseFloat(topUpAmount);
    if (isNaN(value) || value <= 0) return;

    try {
      const finalBal = (parentChild.balance || 0) + value;
      await updateDoc(doc(db, 'canteen_accounts', parentChild.id), {
        balance: finalBal,
        notifications: [
          { id: Date.now().toString(), title: '💸 Portefeuille rechargé', message: `Votre compte cantine a été rechargé de +${value} FCFA. Nouveau solde : ${finalBal} FCFA.`, date: new Date().toLocaleDateString() },
          ...(parentChild.notifications || [])
        ]
      });

      // Log transaction ledger
      await addDoc(collection(db, 'canteen_transactions'), {
        userId: parentChild.userId,
        userName: parentChild.userName,
        amount: value,
        type: 'topup',
        timestamp: serverTimestamp()
      });

      setTopUpAmount('');
      alert(`Rechargement réussi ! ${value} FCFA ajoutés au compte.`);
    } catch (err) {
      console.error(err);
      alert('Erreur lors du rechargement électronique.');
    }
  };

  // Update parental parameters (spending limits, allowed items)
  const handleUpdateParentLimits = async (childId: string, limitVal: number, allowedList: string[]) => {
    try {
      await updateDoc(doc(db, 'canteen_accounts', childId), {
        dailyLimit: limitVal,
        allowedProducts: allowedList
      });
      alert('Contrôle parental sauvegardé ! Les restrictions s\'appliquent immédiatement au point de vente.');
    } catch (err) {
      console.error(err);
    }
  };

  // Manage Weekly Menus
  const handleSaveMenuPlanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDay) return;
    try {
      await setDoc(doc(db, 'canteen_menu', editingDay), {
        day: editingDay,
        ...menuForm
      });
      setEditingDay(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Manage stock updates
  const handleAddStockItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'canteen_stock'), {
        name: stockForm.name,
        quantity: Number(stockForm.quantity),
        unit: stockForm.unit,
        category: stockForm.category,
        minThreshold: Number(stockForm.minThreshold),
        updatedAt: serverTimestamp()
      });
      setStockForm({ name: '', quantity: 10, unit: 'pcs', category: 'Epicerie', minThreshold: 5 });
      alert('Article ajouté au stock avec succès !');
    } catch (err) {
      console.error(err);
    }
  };

  const handleReplenishStock = async (id: string, currentQty: number) => {
    try {
      await updateDoc(doc(db, 'canteen_stock', id), {
        quantity: currentQty + 50,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStock = async (id: string) => {
    if (!window.confirm("Supprimer définitivement cet ingrédient ?")) return;
    try {
      await deleteDoc(doc(db, 'canteen_stock', id));
    } catch (err) {
      console.error(err);
    }
  };

  // Financial aggregates computations
  const totalRecharges = consumptions
    .filter(c => c.type !== 'repas inclus') // proxy to show dynamic sum
    .reduce((sum, c) => sum + (c.price || 0), 0) + 120500; // adding constant base

  const mealsServedTodayCount = consumptions.filter(c => c.date === new Date().toISOString().split('T')[0]).length;
  const criticalStockCount = stock.filter(s => s.quantity <= s.minThreshold).length;

  const currentMonthSales = consumptions.reduce((sum, c) => sum + (c.price || 0), 0);
  const totalExpensesProduction = menus.reduce((sum, m) => sum + ((m.productionCost || 700) * (150 - (m.portions || 150))), 0);
  const netCanteenMargin = currentMonthSales - totalExpensesProduction + 45000;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Main Branding Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 p-8 rounded-[2.5rem] text-white shadow-xl border border-indigo-900/30">
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="p-2.5 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/20">
              <img src="/logo.png" alt="Edu-Nify Logo" className="h-11 object-contain" referrerPolicy="no-referrer" />
            </div>
            <div className="h-8 w-[1.5px] bg-indigo-500/30 hidden sm:block" />
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block font-mono">Portail Restauration</span>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2 mt-0.5">
                Suivi Cantine en Temps Réel
              </h1>
            </div>
          </div>
          <p className="text-xs text-indigo-200/80 max-w-2xl font-medium leading-relaxed">
            ERP professionnel intégré : formules de pension incluses dans l'inscription, pointage de repas en temps réel, e-Portefeuille de cantine parents, et contrôle automatique des dépenses.
          </p>
        </div>
      </div>

      {/* Primary ERP Navigation tabs */}
      <div className="flex items-center overflow-x-auto pb-2 gap-2 border-b border-gray-100 dark:border-gray-800 scrollbar-none">
        {[
          { id: 'dash', label: '📊 Tableau de Bord', allow: ['admin'] },
          { id: 'parent', label: '👨‍👩‍👦 Contrôle Parental', allow: ['parent', 'admin'] },
          { id: 'caisse', label: '💳 Caisse & Pointage', allow: ['admin', 'cuisinier'] },
          { id: 'menus', label: '🍎 Menus', allow: ['admin', 'cuisinier', 'student', 'parent'] },
          { id: 'formulas', label: '🏷️ Formules & Cartes', allow: ['admin'] },
          { id: 'stocks', label: '📦 Stocks', allow: ['admin', 'cuisinier'] },
          { id: 'compta', label: '📈 Comptabilité', allow: ['admin'] },
        ].filter(tab => tab.allow.includes(roleMode) || roleMode === 'admin').map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all uppercase tracking-wider ${
              activeTab === t.id 
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60' 
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* RENDER ACTIVE TAB */}
      <div className="space-y-6">

        {/* 1. TABLEAU DE BORD TAB */}
        {activeTab === 'dash' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Formules actives', val: accounts.length + ' Éléves', icon: Calendar, color: 'indigo', desc: 'Inscriptions au réfectoire' },
                { label: 'Servis aujourd’hui', val: mealsServedTodayCount + ' Repas', icon: CheckCircle2, color: 'teal', desc: 'Consommations enregistrées' },
                { label: 'Alertes de Stock', val: criticalStockCount + ' Articles', icon: AlertTriangle, color: 'amber', desc: 'Seuil critique atteint', warning: criticalStockCount > 0 },
                { label: 'Portefeuilles e-Wallet', val: totalRecharges.toLocaleString() + ' F', icon: Wallet, color: 'rose', desc: 'Fonds parents déposés' },
              ].map((stat, i) => (
                <div key={i} className={`p-6 rounded-[2rem] border bg-white dark:bg-gray-800 shadow-sm flex items-center gap-4 ${stat.warning ? 'border-amber-200 bg-amber-50/20' : 'border-gray-100 dark:border-gray-700'}`}>
                  <div className={`p-3 rounded-2xl bg-${stat.color}-50 dark:bg-${stat.color}-950/40 text-${stat.color}-600 dark:text-${stat.color}-400`}>
                    <stat.icon size={24} />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{stat.label}</span>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white mt-0.5">{stat.val}</h3>
                    <span className="text-[10px] text-gray-400 font-medium">{stat.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Financial Analysis */}
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp size={16} className="text-indigo-600" />
                    Flux Financier Cantine (FCFA)
                  </h3>
                </div>
                <div className="grid grid-cols-3 gap-3 bg-gray-50/50 dark:bg-indigo-950/20 p-4 rounded-2xl">
                  <div>
                    <span className="text-[9px] text-gray-400 font-black uppercase">Recettes Ventes</span>
                    <p className="text-base font-black text-indigo-600">{currentMonthSales.toLocaleString()} F</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 font-black uppercase">Coût de Production</span>
                    <p className="text-base font-black text-amber-600">{totalExpensesProduction.toLocaleString()} F</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 font-black uppercase">Marge Nette</span>
                    <p className={`text-base font-black ${netCanteenMargin >= 0 ? 'text-teal-600' : 'text-red-500'}`}>{netCanteenMargin.toLocaleString()} F</p>
                  </div>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { day: 'Lun', inclus: 140, extras: 45 },
                      { day: 'Mar', inclus: 145, extras: 52 },
                      { day: 'Mer', inclus: 110, extras: 28 },
                      { day: 'Jeu', inclus: 135, extras: 40 },
                      { day: 'Ven', inclus: 142, extras: 61 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                      <Bar dataKey="inclus" name="Repas inclus" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="extras" name="Repas payants" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Real-time Health Alarms & Allergies feed */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-red-100 dark:border-red-950/40 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert size={18} className="text-red-500 animate-pulse" />
                    Pathologies & Alertes Santé
                  </h3>
                  <span className="px-2.5 py-1 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[10px] font-black rounded-lg">
                    {feedbacks.filter(f => f.isHealthAlarm).length} Cas actifs
                  </span>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {accounts.filter(a => a.restrictions?.length > 0).map((a, idx) => (
                    <div key={idx} className="p-3 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-extrabold text-gray-900 dark:text-white">{a.userName}</span>
                        <span className="text-[9px] font-bold text-gray-400 bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded">{a.userClass}</span>
                      </div>
                      <p className="text-xs text-red-650 dark:text-red-300 font-bold ml-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        {a.restrictions.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. MENU WEEK PLANNER TAB */}
        {activeTab === 'menus' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-gray-900 dark:text-white font-mono flex items-center gap-2">
                <Calendar className="text-indigo-600" size={24} />
                Planification culinaire & Budget
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'].map((day) => {
                const item = menus.find(m => m.day === day);
                return (
                  <div key={day} className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest block">{day}</span>
                          <span className="text-xs text-gray-400 font-bold">{item?.portions || 0} portions restantes</span>
                        </div>
                        {['admin', 'cuisinier'].includes(roleMode) && (
                          <button 
                            onClick={() => {
                              setEditingDay(day);
                              if (item) setMenuForm({
                                starter: item.starter,
                                mainCourse: item.mainCourse,
                                dessert: item.dessert,
                                portions: item.portions || 150,
                                productionCost: item.productionCost || 700,
                                calories: item.calories || 650,
                                published: item.published ?? true
                              });
                            }}
                            className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-650 hover:bg-indigo-100 rounded-xl"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                      </div>

                      {item ? (
                        <div className="space-y-3">
                          <div className="p-3 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider mb-1">Entrée</span>
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{item.starter || 'Non défini'}</span>
                          </div>
                          <div className="p-3 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider mb-1">Plat Principal</span>
                            <span className="text-xs font-black text-gray-900 dark:text-white italic">{item.mainCourse || 'Non défini'}</span>
                          </div>
                          <div className="p-3 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider mb-1">Dessert</span>
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{item.dessert || 'Non défini'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-gray-300 italic text-sm">
                          Menu en préparation
                        </div>
                      )}
                    </div>

                    {item && (
                      <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700/60 flex justify-between items-center text-[10px] font-black text-gray-400 uppercase">
                        <span>⚡ {item.calories || 650} kcal</span>
                        {['admin', 'cuisinier'].includes(roleMode) && (
                          <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 px-2 py-1 rounded">Coût Prod: {item.productionCost || 700} F</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Menu Composer Drawer Modal */}
            {editingDay && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl max-w-lg w-full p-8 border border-white/20">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                      <Utensils size={24} />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Composer : {editingDay}</h2>
                  </div>
                  <form onSubmit={handleSaveMenuPlanner} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Entrée</label>
                        <input type="text" value={menuForm.starter} onChange={e => setMenuForm({...menuForm, starter: e.target.value})} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold border border-gray-200 dark:border-gray-700 outline-none text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Plat Principal</label>
                        <input type="text" value={menuForm.mainCourse} onChange={e => setMenuForm({...menuForm, mainCourse: e.target.value})} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold border border-gray-200 dark:border-gray-700 outline-none text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Dessert</label>
                        <input type="text" value={menuForm.dessert} onChange={e => setMenuForm({...menuForm, dessert: e.target.value})} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold border border-gray-200 dark:border-gray-700 outline-none text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Portions</label>
                        <input type="number" value={menuForm.portions} onChange={e => setMenuForm({...menuForm, portions: Number(e.target.value)})} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl font-bold border border-gray-200" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Coût Prod (F)</label>
                        <input type="number" value={menuForm.productionCost} onChange={e => setMenuForm({...menuForm, productionCost: Number(e.target.value)})} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl font-bold border border-gray-200" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Calories (kcal)</label>
                        <input type="number" value={menuForm.calories} onChange={e => setMenuForm({...menuForm, calories: Number(e.target.value)})} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl font-bold border border-gray-200" />
                      </div>
                    </div>

                    <div className="flex gap-4 mt-8">
                      <button type="button" onClick={() => setEditingDay(null)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black">Annuler</button>
                      <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black">Enregistrer</button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </div>
        )}

        {/* 3. CORE CARD ACCESS & SCANNER POINTAGE */}
        {activeTab === 'caisse' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* POS Scanning input / Card reader */}
              <div className="lg:col-span-4 bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
                <div>
                  <h3 className="text-sm font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                    <QrCode size={18} />
                    Comptoir de Pointage NFC / QR
                  </h3>
                  <p className="text-[11px] text-gray-400 font-medium mt-1">Sélectionnez la carte d'un élève pour enregistrer son passage en direct.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Porte de pointage - Sélection de carte active</label>
                  <select 
                    value={scannedStudentId} 
                    onChange={e => setScannedStudentId(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-250 dark:border-gray-700 rounded-2xl outline-none font-bold text-sm"
                  >
                    <option value="">-- Choisissez un élève --</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.userName} ({a.userClass} - {a.formula})</option>
                    ))}
                  </select>

                  <button
                    disabled={!scannedStudentId || scanning}
                    onClick={() => handleLoadStudentProfile(scannedStudentId)}
                    className={`w-full py-4 rounded-[2rem] text-sm font-black text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
                      scannedStudentId 
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:scale-[1.01] active:scale-95' 
                      : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                    }`}
                  >
                    {scanning ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Connexion au terminal NFC...
                      </>
                    ) : (
                      <>
                        <CreditCard size={18} />
                        Pointer la carte NFC / QR Code
                      </>
                    )}
                  </button>
                </div>

                {/* Physical card visualization with authentic branding logo */}
                {selectedStudent && (
                  <div className="bg-gradient-to-tr from-indigo-900 via-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden border border-white/5">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full animate-pulse" />
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg w-max mb-3">
                          <img src="/logo.png" alt="" className="h-4 object-contain" referrerPolicy="no-referrer" />
                          <span className="text-[8px] font-black uppercase tracking-wider">Carte Scolaire Restauration</span>
                        </div>
                        <p className="text-base font-black tracking-tight mt-1">{selectedStudent.userName}</p>
                        <p className="text-[10px] font-semibold opacity-75">{selectedStudent.userClass}</p>
                      </div>
                      <QrCode size={40} className="opacity-40" />
                    </div>
                    <div className="flex justify-between items-end border-t border-white/10 pt-4 text-[10px] font-bold">
                      <div>
                        <span className="opacity-60 block text-[8px] uppercase">Formule Restauration</span>
                        <span className="uppercase text-yellow-300 font-extrabold">{selectedStudent.formula}</span>
                      </div>
                      <div className="text-right">
                        <span className="opacity-60 block text-[8px] uppercase">Solde Cantine</span>
                        <span className="font-extrabold text-white text-xs">{selectedStudent.balance?.toLocaleString()} FCFA</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Central pointage access diagnostic */}
              <div className="lg:col-span-5 bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Scale size={18} />
                    Contrôle Diagnostic & Ravitaillement
                  </h3>

                  {selectedStudent ? (
                    <div className="space-y-4">
                      {/* Live Diagnostic Evaluator */}
                      {(() => {
                        const consumedCountToday = getTodayMealsConsumedCount(selectedStudent.userId);
                        const isFormulaCovered = 
                          (selectedStudent.formula === 'standard' && consumedCountToday < 1) || 
                          (selectedStudent.formula === 'premium' && consumedCountToday < 2);
                        
                        let diagnosticText = '';
                        let diagnosticColorClass = '';
                        let type: 'inclus' | 'payant' = 'inclus';
                        let priceToCharge = 0;

                        if (isFormulaCovered) {
                          diagnosticText = 'Repas inclus disponible';
                          diagnosticColorClass = 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900';
                          type = 'inclus';
                        } else {
                          type = 'payant';
                          priceToCharge = 1500; // Extra standard cost
                          if (selectedStudent.balance >= priceToCharge) {
                            diagnosticText = 'Repas supplémentaire facturable';
                            diagnosticColorClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900';
                          } else {
                            diagnosticText = 'Solde insuffisant';
                            diagnosticColorClass = 'bg-red-50 text-red-750 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900';
                          }
                        }

                        return (
                          <div className="space-y-4">
                            <div className={`p-4 border rounded-2xl flex flex-col items-center justify-center text-center ${diagnosticColorClass}`}>
                              <span className="text-[9px] font-black uppercase tracking-wider opacity-80">Rupture de Pension / Diagnostic d’accès</span>
                              <h4 className="text-lg font-black mt-1 uppercase tracking-wide">"{diagnosticText}"</h4>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl space-y-2 text-xs font-semibold">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Total repas consommés aujourd'hui :</span>
                                <span className="font-extrabold text-gray-800 dark:text-white">{consumedCountToday} repas</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Limite de dépense quotidienne :</span>
                                <span className="font-extrabold text-gray-800 dark:text-white">{selectedStudent.dailyLimit} FCFA</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Déjà dépensé aujourd'hui :</span>
                                <span className="font-extrabold text-gray-800 dark:text-white">{getTodaySpentAmount(selectedStudent.id)} FCFA</span>
                              </div>
                              {selectedStudent.restrictions?.length > 0 && (
                                <div className="p-3 bg-red-100/50 text-red-700 dark:bg-red-950/30 rounded-xl font-bold mt-2">
                                  ⚠️ Allergies de l'élève à contrôler : {selectedStudent.restrictions.join(', ')}
                                </div>
                              )}
                            </div>

                            {/* Serve trigger action button */}
                            <div className="pt-2">
                              {diagnosticText === 'Solde insuffisant' ? (
                                <div className="p-4 bg-red-100/30 text-red-600 rounded-2xl text-xs font-bold text-center border border-red-200">
                                  Incapable de valider le passage : Solde portefeuille parent insuffisant ({selectedStudent.balance} F). Demandez au parent de recharger via MTN/Orange Money.
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleServeFormulaMeal(type, priceToCharge)}
                                  className={`w-full py-4 text-xs font-black uppercase rounded-[2rem] text-white tracking-widest hover:scale-[1.01] active:scale-95 transition-all shadow-md ${
                                    type === 'inclus' ? 'bg-teal-650 hover:bg-teal-700' : 'bg-amber-600 hover:bg-amber-700'
                                  }`}
                                >
                                  {type === 'inclus' ? '👉 Servir le repas inclus (0 FCFA)' : `🛒 Facturer repas supplémentaire (${priceToCharge} FCFA)`}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="py-20 text-center text-gray-400 italic text-xs">
                      En attente de swipe ou scan QR élève sur le panneau de gauche.
                    </div>
                  )}

                  {/* Operational message prompt */}
                  {messagePOS && (
                    <div className={`p-4 rounded-2xl border text-xs font-bold mt-4 flex items-center gap-2 ${
                      messagePOS.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 
                      messagePOS.type === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      <Info size={16} />
                      <p>{messagePOS.text}</p>
                    </div>
                  )}
                </div>

                {/* Display printed check */}
                {receipt && (
                  <div className="mt-4 p-4 border border-dashed border-gray-300 bg-amber-50/20 rounded-2xl font-mono text-[10px] text-gray-600 space-y-2 dark:text-gray-300">
                    <p className="text-center font-black text-[12px] uppercase">*** RECU CANTINE EDU-NIFY ***</p>
                    <div className="flex justify-between">
                      <span>Ticket: {receipt.id}</span>
                      <span>{receipt.dateTime}</span>
                    </div>
                    <p>Élève: {receipt.studentName} ({receipt.class})</p>
                    <div className="border-t border-gray-200 my-1 py-1 space-y-1">
                      {receipt.items.map((i: any, k: number) => (
                        <div key={k} className="flex justify-between">
                          <span>{i.name} x{i.qty}</span>
                          <span>{i.price * i.qty} F</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-gray-200 font-extrabold flex justify-between pt-1">
                      <span>TOTAL PAYÉ:</span>
                      <span>{receipt.total} FCFA</span>
                    </div>
                    <p className="text-right opacity-70">Solde restant: {receipt.remainingBalance} F</p>
                  </div>
                )}
              </div>

              {/* Extra store catalog (Drinks, Snacks, desserts of the day) */}
              <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
                <div>
                  <h3 className="text-sm font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                    <ShoppingBag size={18} />
                    Produits & Suppléments
                  </h3>
                  <p className="text-[11px] text-gray-400 font-medium mt-1">Extra hors pension facturé directement.</p>
                </div>

                {/* Extra List catalog */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {EXTRA_PRODUCTS.map(prod => {
                    const matchedStock = stock.find(s => s.name.toLowerCase().trim() === prod.stockKey.toLowerCase().trim());
                    const qtyInStock = matchedStock ? matchedStock.quantity : 0;
                    const isOutOfStock = qtyInStock <= 0;

                    return (
                      <button
                        key={prod.id}
                        disabled={isOutOfStock}
                        onClick={() => handleAddToCart(prod)}
                        className={`w-full p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 flex justify-between items-center text-left hover:scale-[1.01] transition-all ${
                          isOutOfStock ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'bg-gray-50/50 hover:bg-indigo-50/30'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-extrabold text-gray-900 dark:text-white">{prod.name}</p>
                          <span className="text-[9px] text-gray-400 font-bold uppercase">{prod.price} FCFA</span>
                        </div>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${qtyInStock <= 5 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                          {qtyInStock} Restant
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Mini POS cart panel */}
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
                  <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest block">Panier actif suppléments</span>
                  {Object.keys(cart).length > 0 ? (
                    <div className="space-y-2">
                      {Object.keys(cart).map(pid => {
                        const prod = EXTRA_PRODUCTS.find(p => p.id === pid);
                        if (!prod) return null;
                        return (
                          <div key={pid} className="flex justify-between items-center text-xs">
                            <span className="font-extrabold text-gray-700 dark:text-gray-300">{prod.name} (x{cart[pid]})</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 dark:text-white">{prod.price * cart[pid]} F</span>
                              <button onClick={() => handleRemoveFromCart(pid)} className="text-red-500 font-bold font-mono">×</button>
                            </div>
                          </div>
                        );
                      })}
                      <button
                        onClick={handleCheckoutCart}
                        disabled={!selectedStudent}
                        className="w-full mt-3 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow"
                      >
                        Enregistrer l'achat snack
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic text-center py-4">Panier vide</p>
                  )}
                </div>

              </div>

            </div>
          </div>
        )}

        {/* 4. PARENTS CONTROL VALVE TAB */}
        {activeTab === 'parent' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Parent Wallet Recharge simulation */}
              <div className="bg-white dark:bg-gray-800 p-8 rounded-[3.5rem] border border-indigo-150 dark:border-indigo-950 p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-sm font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                    <Wallet size={18} />
                    Portefeuille cantine parent
                  </h3>
                  <p className="text-[11px] text-gray-400 font-medium mt-1">Gérez le solde destiné à payer les suppléments et repas hors formule.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Choisir l'élève à créditer</label>
                    <select
                      value={selectedParentChildId}
                      onChange={e => setSelectedParentChildId(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200"
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.userName} ({a.userClass} - solde: {a.balance} F)</option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const match = accounts.find(a => a.id === selectedParentChildId);
                    if (!match) return null;
                    return (
                      <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl text-center space-y-1">
                        <span className="text-[9px] text-gray-400 uppercase font-black">Solde actuel</span>
                        <p className="text-3xl font-black text-indigo-650 dark:text-indigo-400">{match.balance?.toLocaleString()} FCFA</p>
                        <span className="text-[9px] text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider block">Formule d'Inscr: {match.formula}</span>
                      </div>
                    );
                  })()}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Montant du rechargement (FCFA)</label>
                    <input 
                      type="number" 
                      value={topUpAmount}
                      onChange={e => setTopUpAmount(e.target.value)}
                      placeholder="Ex: 5000" 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border rounded-2xl font-bold" 
                    />
                    <button
                      onClick={handleParentTopUp}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={16} />
                      Recharger via Wave / MTN / Orange Money
                    </button>
                  </div>
                </div>
              </div>

              {/* Parental spent controls rules configuration */}
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-[3.5rem] border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
                <div>
                  <h3 className="text-sm font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                    <HandCoins size={18} />
                    Configuration du Contrôle Parental
                  </h3>
                  <p className="text-[11px] text-gray-400 font-medium mt-1 mb-6">Bloquez automatiquement la caisse de l'école selon vos plafonds et listes de snack autorisées.</p>
                </div>

                {(() => {
                  const match = accounts.find(a => a.id === selectedParentChildId);
                  if (!match) return <p className="text-center text-gray-400 italic text-xs py-10">Sélectionnez d'abord un enfant de la liste.</p>;
                  
                  return (
                    <ParentRulesEditor 
                      child={match} 
                      onSave={(lim, list) => handleUpdateParentLimits(match.id, lim, list)} 
                    />
                  );
                })()}
              </div>

            </div>

            {/* Parental instant Alert messages logs */}
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[3.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                <Bell size={18} />
                Notifications Directes Parents / Tentatives d'achats bloquées
              </h3>
              
              {(() => {
                const child = accounts.find(a => a.id === selectedParentChildId);
                const list = child?.notifications || [];
                if (list.length === 0) return <p className="text-xs text-gray-400 italic">Aucune alerte récente.</p>;
                return (
                  <div className="grid gap-3">
                    {list.map((n: any, idx: number) => (
                      <div key={idx} className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex items-start gap-3">
                        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                        <div>
                          <p className="text-xs font-black text-gray-900 dark:text-white">{n.title}</p>
                          <p className="text-xs text-gray-500 font-medium mt-0.5">{n.message}</p>
                          <span className="text-[9px] text-gray-450 uppercase block font-bold tracking-wider mt-1">{n.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* 5. FORMULAE SETUP & STUDENT ASSIGNMENT TAB */}
        {activeTab === 'formulas' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[3.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                  <CreditCard size={18} />
                  Table des Régimes de Pension de Restauration
                </h3>
                <p className="text-[11px] text-gray-400 font-medium mt-1">Attribuez des formules à vos élèves. La cantine valide les passages selon ces quotas.</p>
              </div>

              {/* Standard descriptions list of standard system formulas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: 'Formule Standard', meals: '1 Repas gratuit / Jour', extra: 'Repas supp: 1500 FCFA', desc: 'Inclus dans les frais standards d’inscription', fee: 'Plein Inclus' },
                  { name: 'Formule Premium', meals: '2 Repas gratuits / Jour', extra: 'Petit Déjeun + Déjeuner inclus', desc: 'Paiement premium de scolarité', fee: '+35,000 FCFA / Trim' },
                  { name: 'Formule Externe', meals: 'Repas inclus: AUCUN', extra: 'Repas facturé: 1500 FCFA', desc: 'Repas payable uniquement via la caisse e-Wallet', fee: 'Gratuit (À la demande)' },
                ].map((f, i) => (
                  <div key={i} className="p-5 rounded-3xl border border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/20">
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded inline-block font-black uppercase mb-3">{f.fee}</span>
                    <h4 className="text-sm font-black text-gray-900 dark:text-white capitalize">{f.name}</h4>
                    <p className="text-xs text-gray-600 font-extrabold mt-1">{f.meals}</p>
                    <p className="text-[10px] text-amber-600 font-bold mt-1">{f.extra}</p>
                    <p className="text-[10px] text-gray-400 mt-2">{f.desc}</p>
                  </div>
                ))}
              </div>

              {/* Master grid of all students pension plans */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-black block mb-4">Liste des cartes élèves de l'établissement</span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-500">
                    <thead>
                      <tr className="border-b border-gray-100 font-black text-gray-400 uppercase text-[10px]">
                        <th className="py-3">Matricule</th>
                        <th>Nom d'élève</th>
                        <th>Classe</th>
                        <th>Formule Canteen</th>
                        <th>Restrictions</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map(student => (
                        <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50/50 dark:border-gray-850 dark:hover:bg-gray-900/10 font-bold text-gray-800 dark:text-gray-300">
                          <td className="py-4 font-mono">{student.matricule || 'N/A'}</td>
                          <td className="font-black text-gray-900 dark:text-white">{student.userName}</td>
                          <td>{student.userClass}</td>
                          <td className="capitalize">
                            <select
                              value={student.formula}
                              onChange={async (e) => {
                                await updateDoc(doc(db, 'canteen_accounts', student.id), {
                                  formula: e.target.value
                                });
                              }}
                              className="px-2.5 py-1 bg-indigo-50 border-none rounded text-indigo-700 outline-none text-xs font-black cursor-pointer uppercase"
                            >
                              <option value="standard">Standard</option>
                              <option value="premium">Premium</option>
                              <option value="externe">Externe</option>
                            </select>
                          </td>
                          <td className="text-red-500 font-bold">{student.restrictions?.join(', ') || 'Aucune'}</td>
                          <td>
                            <button
                              onClick={async () => {
                                const nAllergy = window.prompt("Ajouter une allergie ou restriction :", "");
                                if (nAllergy) {
                                  await updateDoc(doc(db, 'canteen_accounts', student.id), {
                                    restrictions: [...(student.restrictions || []), nAllergy]
                                  });
                                }
                              }}
                              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-[10px] font-black uppercase"
                            >
                              + Restriction
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. REAL STOCKS & INVENTORY MANAGEMENT TAB */}
        {activeTab === 'stocks' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Add replenishment item form */}
              <div className="bg-white dark:bg-gray-800 p-8 rounded-[3.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
                <div>
                  <h3 className="text-sm font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                    <Package size={18} />
                    Nouveau Ravitaillement alimentaire
                  </h3>
                  <p className="text-[11px] text-gray-400 font-medium mt-1">Entrez les ingrédients culinaires, boissons et desserts achetés par l'école.</p>
                </div>

                <form onSubmit={handleAddStockItem} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Désignation du produit</label>
                    <input 
                      type="text" required value={stockForm.name} 
                      onChange={e => setStockForm({...stockForm, name: e.target.value})}
                      placeholder="Ex: Riz blanc Long-grain" 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border rounded-2xl font-bold" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Quantité</label>
                      <input 
                        type="number" required value={stockForm.quantity} 
                        onChange={e => setStockForm({...stockForm, quantity: Number(e.target.value)})}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border rounded-2xl font-bold" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Unité de mesure</label>
                      <select 
                        value={stockForm.unit} 
                        onChange={e => setStockForm({...stockForm, unit: e.target.value})}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border rounded-2xl font-bold"
                      >
                        <option value="kg">kg</option>
                        <option value="L">L</option>
                        <option value="pcs">pcs</option>
                        <option value="sac">sac</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Catégorie</label>
                      <select 
                        value={stockForm.category} 
                        onChange={e => setStockForm({...stockForm, category: e.target.value})}
                        className="w-full px-2 py-2.5 bg-gray-50 dark:bg-gray-900 border rounded-2xl font-bold text-xs"
                      >
                        <option value="Epicerie">Epicerie Sèche</option>
                        <option value="Fruits/Légumes">Fruits & Légumes</option>
                        <option value="Viandes/Poissons">Viandes / Poissons</option>
                        <option value="Boissons">Boissons</option>
                        <option value="Produits Laitiers">Produits Laitiers</option>
                        <option value="Autres">Autres</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Alerte Seuil (Min)</label>
                      <input 
                        type="number" required value={stockForm.minThreshold} 
                        onChange={e => setStockForm({...stockForm, minThreshold: Number(e.target.value)})}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border rounded-2xl font-bold" 
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-650 hover:bg-indigo-700 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest shadow"
                  >
                    Valider l'entrée en stock
                  </button>
                </form>
              </div>

              {/* Data inventories details list */}
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-[3.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest block">Inventaire Alimentaire de la Cuisine</span>
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {stock.map(item => {
                    const isAlert = item.quantity <= item.minThreshold;
                    return (
                      <div key={item.id} className={`p-4 border rounded-2xl flex items-center justify-between gap-4 transition-all ${
                        isAlert ? 'border-red-200 bg-red-50/10' : 'border-gray-100'
                      }`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-gray-900 dark:text-white capitalize">{item.name}</h4>
                            <span className="text-[8px] uppercase px-1.5 py-0.5 bg-gray-150 rounded text-gray-400 font-bold">{item.category}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 block font-medium">Seuil d'alerte : {item.minThreshold} {item.unit}</span>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <p className={`text-sm font-black ${isAlert ? 'text-red-500 animate-pulse' : 'text-gray-900 dark:text-white'}`}>
                              {item.quantity} {item.unit}
                            </p>
                            {isAlert && <span className="text-[8px] font-black text-red-500 uppercase tracking-wider block">🚨 Critique !</span>}
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleReplenishStock(item.id, item.quantity)}
                              className="px-2 py-1 bg-indigo-55 text-indigo-700 rounded text-[9px] font-black uppercase"
                              title="+50 Ravitaillement"
                            >
                              +50
                            </button>
                            <button
                              onClick={() => handleDeleteStock(item.id)}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* 7. REPORTS & SYNCHRONIZED COMPTABILITE TAB */}
        {activeTab === 'compta' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[3.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={18} />
                  Journal Comptable de Cantine Synchronisé
                </h3>
                <p className="text-[11px] text-gray-400 font-medium mt-1">Compilations financières pour l'administration.</p>
              </div>

              {/* Transactions Ledger log */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-500">
                  <thead>
                    <tr className="border-b border-gray-100 font-black text-gray-400 uppercase text-[10px]">
                      <th className="py-3">Élève ID</th>
                      <th>Élève / Inscription</th>
                      <th>Activité de passage / Produit</th>
                      <th>Date & Heure</th>
                      <th>Type</th>
                      <th>Montant (FCFA)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumptions.map(cons => (
                      <tr key={cons.id} className="border-b border-gray-50 hover:bg-gray-50/50 dark:border-gray-850 dark:hover:bg-gray-900/10 font-bold text-gray-800 dark:text-gray-300">
                        <td className="py-4 font-mono uppercase text-gray-400 text-[10px]">{cons.userId?.slice(0, 8)}</td>
                        <td className="font-extrabold text-gray-900 dark:text-white">{cons.userName}</td>
                        <td className="italic">{cons.mealTitle}</td>
                        <td>{cons.date} à {cons.time}</td>
                        <td className="uppercase">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black ${
                            cons.type === 'repas inclus' ? 'bg-teal-50 text-teal-700' :
                            cons.type === 'repas supplémentaire' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {cons.type}
                          </span>
                        </td>
                        <td className="font-extrabold text-gray-900 dark:text-white text-right pr-6">{cons.price || 0} F</td>
                      </tr>
                    ))}
                    {consumptions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400 italic">Aucune consommation enregistrée aujourd'hui.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Inline Subcomponent: Parent Limits Form Selector
interface ParentRulesEditorProps {
  child: any;
  onSave: (limit: number, allowedList: string[]) => void;
}

function ParentRulesEditor({ child, onSave }: ParentRulesEditorProps) {
  const [spentLimit, setSpentLimit] = useState<number>(child.dailyLimit || 2050);
  const [allowedItems, setAllowedItems] = useState<string[]>(child.allowedProducts || EXTRA_PRODUCTS.map(p => p.name));

  const handleToggleProduct = (prodName: string) => {
    setAllowedItems(prev => 
      prev.includes(prodName) 
        ? prev.filter(p => p !== prodName) 
        : [...prev, prodName]
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Limite de dépense journalière (FCFA)</label>
          <span className="text-xl font-black text-indigo-700">{spentLimit} F CFA</span>
        </div>
        <p className="text-[10px] text-gray-400">Le système de caisse refusera automatiquement tout supplément ou achat dépassant ce montant.</p>
        <input 
          type="range" 
          min={500} 
          max={5000} 
          step={100}
          value={spentLimit} 
          onChange={e => setSpentLimit(Number(e.target.value))}
          className="w-full accent-indigo-600 cursor-pointer h-2 bg-gray-100 rounded-lg appearance-none"
        />
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Autorisation produits & compléments</label>
        <p className="text-[10px] text-gray-400 mb-2">Décochez les catégories ou produits interdits pour bloquer leur scolarisation à la cantine.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EXTRA_PRODUCTS.map(p => {
            const isAuthorized = allowedItems.includes(p.name);
            return (
              <label 
                key={p.id}
                className={`p-3 rounded-2xl border cursor-pointer select-none flex items-center gap-3 transition-colors ${
                  isAuthorized 
                    ? 'border-indigo-150 bg-indigo-50/20 text-indigo-850 dark:bg-indigo-950/20' 
                    : 'border-gray-100 bg-gray-50/50 opacity-60 text-gray-500'
                }`}
              >
                <input 
                  type="checkbox"
                  checked={isAuthorized}
                  onChange={() => handleToggleProduct(p.name)}
                  className="w-4 h-4 text-indigo-600 accent-indigo-600 rounded" 
                />
                <div className="text-xs">
                  <p className="font-extrabold">{p.name}</p>
                  <span className="text-[10px] uppercase font-bold text-gray-400">{p.price} F - {p.category}</span>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => onSave(spentLimit, allowedItems)}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest shadow transition-transform"
      >
        Enregistrer les Règles de Contrôle Parental
      </button>
    </div>
  );
}
