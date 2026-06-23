import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp, 
  doc, 
  setDoc,
  updateDoc 
} from 'firebase/firestore';
import { 
  User, 
  Briefcase, 
  Coins, 
  Calendar, 
  FileText, 
  Printer, 
  Plus, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Percent, 
  Truck, 
  Building2, 
  ArrowUpRight, 
  ArrowDownRight,
  Sparkles,
  ClipboardList
} from 'lucide-react';

interface FinanceExtraModulesProps {
  activeTab: string;
  students: any[];
  teachers: any[];
  staff: any[];
  currentEstablishment: any;
  payments: any[];
  setPayments: React.Dispatch<React.SetStateAction<any[]>>;
}

export const FinanceExtraModules: React.FC<FinanceExtraModulesProps> = ({
  activeTab,
  students,
  teachers,
  staff,
  currentEstablishment,
  payments,
  setPayments
}) => {
  const currentEstId = currentEstablishment?.id || 'EDU-001';

  // --- STATE FOR MODULES ---
  // 1. Payroll
  const [paySlips, setPaySlips] = useState<any[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [baseSalary, setBaseSalary] = useState(350000);
  const [primes, setPrimes] = useState(50000);
  const [heuresSup, setHeuresSup] = useState(0);
  const [tauxHeureSup, setTauxHeureSup] = useState(5000);
  const [deductions, setDeductions] = useState(0);
  const [avances, setAvances] = useState(0);
  const [payrollPeriod, setPayrollPeriod] = useState('Juin 2026');
  const [viewingSlipId, setViewingSlipId] = useState<string | null>(null);

  // 2. Assets (Immobilisations)
  const [assets, setAssets] = useState<any[]>([]);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState('Matériel Pédagogique');
  const [acquisitionValue, setAcquisitionValue] = useState(1200000);
  const [lifespan, setLifespan] = useState(5);
  const [acquisitionDate, setAcquisitionDate] = useState('2026-06-01');
  const [amortizationType, setAmortizationType] = useState<'lineaire' | 'degressif'>('lineaire');
  const [selectedAssetForSchedule, setSelectedAssetForSchedule] = useState<any | null>(null);

  // 3. Suppliers (Fournisseurs)
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierService, setSupplierService] = useState('Aménagement & Travaux');
  const [supplierTransactions, setSupplierTransactions] = useState<any[]>([]);
  const [showSupplierTxModal, setShowSupplierTxModal] = useState(false);
  const [selectedSupplierForTx, setSelectedSupplierForTx] = useState<any | null>(null);
  const [txAmount, setTxAmount] = useState(150000);
  const [txType, setTxType] = useState<'invoice' | 'payment'>('invoice');
  const [txDescription, setTxDescription] = useState('Achat de tableaux blancs et pupitres');

  // 4. Bourses & Remises
  const [scholarships, setScholarships] = useState<any[]>([]);
  const [showScholarshipModal, setShowScholarshipModal] = useState(false);
  const [selectedStudentForScholarship, setSelectedStudentForScholarship] = useState<string>('');
  const [scholarshipType, setScholarshipType] = useState<'remise_familiale' | 'remise_personnel' | 'bourse_partielle' | 'bourse_totale' | 'aide_exceptionnelle'>('bourse_partielle');
  const [scholarshipPercent, setScholarshipPercent] = useState(50);
  const [scholarshipNotes, setScholarshipNotes] = useState('Bourse octroyée sur critères d\'excellence académique.');

  // Combining teachers and staff for simplified payroll selection
  const allEmployees = [
    ...teachers.filter(t => t.etablissement === currentEstId).map(t => ({ ...t, roleLabel: 'Enseignant' })),
    ...staff.filter(s => s.etablissement === currentEstId).map(s => ({ ...s, roleLabel: s.position || 'Administratif' }))
  ];

  // List of students in active establishment
  const estStudents = students.filter(s => s.etablissement === currentEstId);

  // --- PERSISTENCE EFFECT LOADERS ---
  useEffect(() => {
    // We attach onSnapshot listeners with local storage fallbacks to be completely bulletproof
    const payrollQuery = query(collection(db, 'payroll_slips'), where('establishmentId', '==', currentEstId));
    const unsubscribePayroll = onSnapshot(payrollQuery, (snap) => {
      if (!snap.empty) {
        setPaySlips(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        // Localstorage fallback
        const local = localStorage.getItem(`slips_${currentEstId}`);
        if (local) setPaySlips(JSON.parse(local));
      }
    }, (err) => {
      console.warn("Payroll firestore read restricted, loading local cache", err);
      const local = localStorage.getItem(`slips_${currentEstId}`);
      if (local) setPaySlips(JSON.parse(local));
    });

    const assetsQuery = query(collection(db, 'assets_registry'), where('establishmentId', '==', currentEstId));
    const unsubscribeAssets = onSnapshot(assetsQuery, (snap) => {
      if (!snap.empty) {
        setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        const local = localStorage.getItem(`assets_${currentEstId}`);
        if (local) setAssets(JSON.parse(local));
      }
    }, (err) => {
      console.warn("Assets firestore read restricted, loading local cache", err);
      const local = localStorage.getItem(`assets_${currentEstId}`);
      if (local) setAssets(JSON.parse(local));
    });

    const suppliersQuery = query(collection(db, 'suppliers_registry'), where('establishmentId', '==', currentEstId));
    const unsubscribeSuppliers = onSnapshot(suppliersQuery, (snap) => {
      if (!snap.empty) {
        setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        const local = localStorage.getItem(`suppliers_${currentEstId}`);
        if (local) setSuppliers(JSON.parse(local));
      }
    }, (err) => {
      console.warn("Suppliers firestore read restricted, loading local cache", err);
      const local = localStorage.getItem(`suppliers_${currentEstId}`);
      if (local) setSuppliers(JSON.parse(local));
    });

    const supplierTxQuery = query(collection(db, 'supplier_transactions'), where('establishmentId', '==', currentEstId));
    const unsubscribeSupplierTx = onSnapshot(supplierTxQuery, (snap) => {
      if (!snap.empty) {
        setSupplierTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        const local = localStorage.getItem(`supplier_tx_${currentEstId}`);
        if (local) setSupplierTransactions(JSON.parse(local));
      }
    }, (err) => {
      console.warn("Supplier transactions firestore read restricted, loading local cache", err);
      const local = localStorage.getItem(`supplier_tx_${currentEstId}`);
      if (local) setSupplierTransactions(JSON.parse(local));
    });

    const scholarshipQuery = query(collection(db, 'scholarships_registry'), where('establishmentId', '==', currentEstId));
    const unsubscribeScholarship = onSnapshot(scholarshipQuery, (snap) => {
      if (!snap.empty) {
        setScholarships(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        const local = localStorage.getItem(`scholarships_${currentEstId}`);
        if (local) setScholarships(JSON.parse(local));
      }
    }, (err) => {
      console.warn("Scholarships firestore read restricted, loading local cache", err);
      const local = localStorage.getItem(`scholarships_${currentEstId}`);
      if (local) setScholarships(JSON.parse(local));
    });

    return () => {
      unsubscribePayroll();
      unsubscribeAssets();
      unsubscribeSuppliers();
      unsubscribeSupplierTx();
      unsubscribeScholarship();
    };
  }, [currentEstId]);

  // Handle local write functions that write to BOTH firestore & local storage
  const saveToBoth = async (collName: string, docData: any, localKey: string, setState: any) => {
    try {
      await addDoc(collection(db, collName), docData);
    } catch (e) {
      console.warn(`Could not add to firestore ${collName}, writing locally only:`, e);
    }
    // Update local state and localStorage
    const currentLocal = localStorage.getItem(localKey);
    const list = currentLocal ? JSON.parse(currentLocal) : [];
    const newDoc = { id: `local_${Date.now()}`, ...docData, createdAt: new Date().toISOString() };
    const updated = [newDoc, ...list];
    localStorage.setItem(localKey, JSON.stringify(updated));
    setState(updated);
  };

  // --- ACTIONS ---
  
  // 1. Pay Slip Emit Action
  const handleCreatePaySlip = async () => {
    if (!selectedStaff) return;
    
    // Net salary calculation
    const earnings = baseSalary + primes + (heuresSup * tauxHeureSup);
    const totalDeductions = deductions + avances;
    const netSalary = Math.max(0, earnings - totalDeductions);

    const slip = {
      employeeId: selectedStaff.id,
      employeeName: `${selectedStaff.prenom || ''} ${selectedStaff.nom || ''}`,
      employeeRole: selectedStaff.roleLabel,
      baseSalary,
      primes,
      heuresSup,
      tauxHeureSup,
      deductions,
      avances,
      totalEarnings: earnings,
      totalDeductions,
      netSalary,
      period: payrollPeriod,
      establishmentId: currentEstId,
      dateGenerated: new Date().toLocaleDateString('fr-FR'),
      slipNumber: `PAY-${Date.now().toString().slice(-6)}`
    };

    await saveToBoth(
      'payroll_slips',
      slip,
      `slips_${currentEstId}`,
      setPaySlips
    );

    // Also trigger simulated Double Entry accounting if possible for Salaries Standard (Classe 621000 Debit vs 521000/512000 Credit)
    try {
      const entryRef = collection(db, 'accounting_entries');
      const doubleEntry = {
        date: new Date().toISOString().split('T')[0],
        reference: slip.slipNumber,
        label: `Rémunération ${slip.employeeName} (${slip.period})`,
        debitAccount: selectedStaff.roleLabel === 'Enseignant' ? '621050' : '621100', // SYSCOHADA Standard
        creditAccount: '521000', // paid from main cash office
        amount: netSalary,
        establishmentId: currentEstId,
        status: 'valide',
        recordedByName: 'Comptable Principal',
        createdAt: serverTimestamp()
      };
      await addDoc(entryRef, doubleEntry);
    } catch (err) {
      console.warn("Could not post automatic ledger entry for payroll:", err);
    }

    setShowPayModal(false);
    setSelectedStaff(null);
  };

  // 2. Asset Registration Action
  const handleAddAsset = async () => {
    if (!assetName) return;

    const rate = 100 / lifespan; // linear rate %
    const asset = {
      name: assetName,
      category: assetCategory,
      acquisitionValue,
      lifespan,
      acquisitionDate,
      amortizationType,
      rate,
      establishmentId: currentEstId,
      status: 'actif'
    };

    await saveToBoth(
      'assets_registry',
      asset,
      `assets_${currentEstId}`,
      setAssets
    );
    setShowAssetModal(false);
    setAssetName('');
  };

  // Calculate Linear Amortization schedule dynamically
  const calculateAmortizationSchedule = (asset: any) => {
    const years = asset.lifespan;
    const value = asset.acquisitionValue;
    const annualAmortization = value / years;
    const schedule = [];
    let accumAmortization = 0;
    const buyYear = new Date(asset.acquisitionDate).getFullYear();

    for (let i = 1; i <= years; i++) {
      accumAmortization += annualAmortization;
      const endingVnc = Math.max(0, value - accumAmortization);
      schedule.push({
        year: buyYear + i - 1,
        beginningVnc: value - (accumAmortization - annualAmortization),
        annuity: annualAmortization,
        accumulated: accumAmortization,
        endingVnc
      });
    }
    return schedule;
  };

  // 3. Supplier Action
  const handleAddSupplier = async () => {
    if (!supplierName) return;

    const supplier = {
      name: supplierName,
      email: supplierEmail,
      phone: supplierPhone,
      address: supplierAddress,
      service: supplierService,
      establishmentId: currentEstId
    };

    await saveToBoth(
      'suppliers_registry',
      supplier,
      `suppliers_${currentEstId}`,
      setSuppliers
    );
    setShowSupplierModal(false);
    setSupplierName('');
    setSupplierEmail('');
    setSupplierPhone('');
    setSupplierAddress('');
  };

  // Add Supplier Transaction (Invoice / Payment)
  const handleAddSupplierTx = async () => {
    if (!selectedSupplierForTx) return;

    const tx = {
      supplierId: selectedSupplierForTx.id,
      supplierName: selectedSupplierForTx.name,
      amount: txAmount,
      type: txType,
      description: txDescription,
      date: new Date().toISOString().split('T')[0],
      establishmentId: currentEstId,
      reference: `FAC-${Date.now().toString().slice(-6)}`
    };

    await saveToBoth(
      'supplier_transactions',
      tx,
      `supplier_tx_${currentEstId}`,
      setSupplierTransactions
    );

    // Also link to double entry ledger
    try {
      const entryRef = collection(db, 'accounting_entries');
      const doubleEntry = {
        date: tx.date,
        reference: tx.reference,
        label: `${txType === 'invoice' ? 'Facture' : 'Paiement'} Fournisseur - ${tx.supplierName}`,
        debitAccount: txType === 'invoice' ? '601000' : '401100', // Purchases vs Supplier debt account (Classe 401)
        creditAccount: txType === 'invoice' ? '401100' : '521000', // Supplier debt credit vs Bank/Cash payment credit
        amount: txAmount,
        establishmentId: currentEstId,
        status: 'valide',
        recordedByName: 'Comptable Principal',
        createdAt: serverTimestamp()
      };
      await addDoc(entryRef, doubleEntry);
    } catch (err) {
      console.warn("Could not post automatic ledger entry for supplier transaction:", err);
    }

    setShowSupplierTxModal(false);
    setSelectedSupplierForTx(null);
  };

  // 4. Scholarship / Remise Action
  const handleAddScholarship = async () => {
    if (!selectedStudentForScholarship) return;

    const studentObj = estStudents.find(s => s.id === selectedStudentForScholarship);
    if (!studentObj) return;

    // Standard total tuition reference used in France tab model is 450,000 FCFA
    const totalBaseTuition = 450000;
    const reductionVal = (scholarshipPercent / 100) * totalBaseTuition;

    const sch = {
      studentId: selectedStudentForScholarship,
      studentName: `${studentObj.prenom || ''} ${studentObj.nom || ''}`,
      matricule: studentObj.matricule || 'N/A',
      type: scholarshipType,
      percent: scholarshipPercent,
      deductedAmount: reductionVal,
      notes: scholarshipNotes,
      establishmentId: currentEstId,
      dateApplied: new Date().toLocaleDateString('fr-FR')
    };

    await saveToBoth(
      'scholarships_registry',
      sch,
      `scholarships_${currentEstId}`,
      setScholarships
    );

    // Automatically generate a negative helper payment on behalf of the student or adjust their total dues
    try {
      const payRef = collection(db, 'payments');
      const scholarshipPayment = {
        studentId: selectedStudentForScholarship,
        studentName: sch.studentName,
        matricule: sch.matricule,
        amount: reductionVal,
        type: 'scholarship_deduction',
        status: 'paid', // directly accounted for
        mode: 'Virement',
        date: new Date().toISOString().split('T')[0],
        period: 'Annuelle',
        caisseId: 'SCHOLARSHIP-SYSTEM',
        comment: `DÉDUCTION AUTOMATIQUE : ${scholarshipType.toUpperCase()} (${scholarshipPercent}%) - ${scholarshipNotes}`,
        createdAt: serverTimestamp()
      };
      await addDoc(payRef, scholarshipPayment);
      
      // Update local context payments if passed
      setPayments(prev => [scholarshipPayment, ...prev]);

    } catch (err) {
      console.warn("Could not publish automatic scholarship reduction payment:", err);
    }

    setShowScholarshipModal(false);
    setSelectedStudentForScholarship('');
    setScholarshipNotes('');
  };


  // --- SUB-TABS VIEWS ---

  // A. PAYROLL TAB
  if (activeTab === 'payroll') {
    const selectedSlip = paySlips.find(s => s.id === viewingSlipId);

    return (
      <div className="space-y-6">
        {/* Module Header card */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-800 text-white p-6 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
            <span className="px-2.5 py-1 bg-white/10 rounded-md text-[10px] font-black uppercase tracking-wider">
              💼 RH & Salaires
            </span>
            <h2 className="text-xl font-bold mt-1.5 uppercase tracking-wide">Gestion de la Paie Etablissement</h2>
            <p className="text-xs text-teal-100 mt-1">
              Gérez les salaires de base, enregistrez les primes, heures supplémentaires et sortez les bulletins de paie PDF signés.
            </p>
          </div>
          <button
            onClick={() => {
              if (allEmployees.length === 0) {
                alert("Aucun employé rattaché à cet établissement. Créez des enseignants ou du personnel administratif d'abord !");
                return;
              }
              setSelectedStaff(allEmployees[0]);
              setShowPayModal(true);
            }}
            className="px-4 py-2.5 bg-white text-teal-800 hover:bg-teal-50 rounded-xl transition-all font-black uppercase text-[11px] flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={15} /> Calculer un salaire
          </button>
        </div>

        {/* Slips table registry */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-750">
          <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4">
            Historique des Ématures & Bulletins Émis
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-150 pb-2 text-[10px] font-black uppercase text-gray-400">
                  <th className="py-2.5">Référence & Période</th>
                  <th className="py-2.5">Collaborateur / Profil</th>
                  <th className="py-2.5 text-right">Brut Brut & Retenues</th>
                  <th className="py-2.5 text-right">Net À Payer</th>
                  <th className="py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {paySlips.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider">
                      Aucun salaire n'a encore été préparé pour ce mois ou ce campus.
                    </td>
                  </tr>
                ) : (
                  paySlips.map(slip => (
                    <tr key={slip.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-750/30">
                      <td className="py-3">
                        <span className="font-mono font-bold text-gray-900 dark:text-white block">{slip.slipNumber}</span>
                        <span className="text-[10px] text-gray-400 font-bold">{slip.period}</span>
                      </td>
                      <td className="py-3">
                        <p className="font-bold">{slip.employeeName}</p>
                        <span className="text-[9px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-gray-500 uppercase font-bold">{slip.employeeRole}</span>
                      </td>
                      <td className="py-3 text-right">
                        <p className="font-medium text-emerald-600">+{slip.totalEarnings.toLocaleString()} F</p>
                        <p className="text-[10px] text-rose-500">-{slip.totalDeductions.toLocaleString()} F</p>
                      </td>
                      <td className="py-3 text-right font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                        {slip.netSalary.toLocaleString()} FCFA
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => setViewingSlipId(slip.id)}
                          className="px-2.5 py-1.5 bg-indigo-55 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg text-[10px] font-black uppercase transition-all"
                        >
                          👁️ Bulletin PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL CALCUL PAYROLL */}
        {showPayModal && selectedStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 rounded-[30px] p-6 max-w-2xl w-full space-y-4 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase">Émission d'un Bulletin de Salaire</h3>
                <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Sélectionner l'employé</label>
                  <select
                    value={selectedStaff.id}
                    onChange={(e) => {
                      const found = allEmployees.find(emp => emp.id === e.target.value);
                      if (found) setSelectedStaff(found);
                    }}
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-800 text-xs text-gray-800 dark:text-gray-200"
                  >
                    {allEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.prenom} {emp.nom} ({emp.roleLabel})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Période ou mois de paye</label>
                  <input
                    type="text"
                    value={payrollPeriod}
                    onChange={(e) => setPayrollPeriod(e.target.value)}
                    placeholder="Ex: Juin 2026"
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-800 text-xs text-gray-800 dark:text-gray-200"
                  />
                </div>

                <div className="space-y-1.5 col-span-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Salaire de Base Brut (FCFA)</label>
                  <input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-800 text-xs text-gray-800 dark:text-gray-200 font-mono"
                  />
                </div>

                <div className="space-y-1.5 col-span-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Primes & Bonus (FCFA)</label>
                  <input
                    type="number"
                    value={primes}
                    onChange={(e) => setPrimes(Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-800 text-xs text-gray-800 dark:text-gray-200 font-mono"
                  />
                </div>

                <div className="space-y-1.5 col-span-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono">Nombre d'Heures Sup</label>
                  <input
                    type="number"
                    value={heuresSup}
                    onChange={(e) => setHeuresSup(Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-800 text-xs text-gray-800 dark:text-gray-200 font-mono"
                  />
                </div>

                <div className="space-y-1.5 col-span-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Taux par Heure Sup (FCFA)</label>
                  <input
                    type="number"
                    value={tauxHeureSup}
                    onChange={(e) => setTauxHeureSup(Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-800 text-xs text-gray-800 dark:text-gray-200 font-mono"
                  />
                </div>

                <div className="space-y-1.5 col-span-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Avances sur Salaire déjà versées</label>
                  <input
                    type="number"
                    value={avances}
                    onChange={(e) => setAvances(Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-800 text-xs text-gray-800 dark:text-gray-200 font-mono text-rose-500"
                  />
                </div>

                <div className="space-y-1.5 col-span-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Autres Déductions & Absences</label>
                  <input
                    type="number"
                    value={deductions}
                    onChange={(e) => setDeductions(Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-800 text-xs text-gray-800 dark:text-gray-200 font-mono text-rose-500"
                  />
                </div>
              </div>

              {/* Dynamic Live Calculations Banner */}
              <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Total Salaire Brut Estimé :</span>
                  <span className="font-black text-emerald-400">
                    {(baseSalary + primes + (heuresSup * tauxHeureSup)).toLocaleString()} FCFA
                  </span>
                </div>
                <div className="flex justify-between text-xs border-b border-white/10 pb-2">
                  <span className="text-gray-400">Total Retenues & Avances :</span>
                  <span className="font-black text-rose-400">
                    {(deductions + avances).toLocaleString()} FCFA
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-1">
                  <span className="font-bold text-gray-100">NET APPARENANT À PAYER :</span>
                  <span className="font-mono font-black text-xl text-yellow-400">
                    {Math.max(0, (baseSalary + primes + (heuresSup * tauxHeureSup)) - (deductions + avances)).toLocaleString()} FCFA
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreatePaySlip}
                  className="px-4 py-2 bg-indigo-600 text-white hover:bg-slate-905 rounded-xl text-xs font-black uppercase shadow"
                >
                  Confirmer & Enregistrer Comptabilité
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PRINTABLE BULLETIN MODEL SLIP PREVIEW MODAL */}
        {selectedSlip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-[32px] p-8 max-w-2xl w-full space-y-6 border border-gray-100 shadow-2xl relative">
              <button
                onClick={() => setViewingSlipId(null)}
                className="absolute right-6 top-6 text-gray-400 hover:text-gray-600 text-xl font-bold font-mono"
              >
                ×
              </button>

              {/* BULLETIN PRINT CONTAINER */}
              <div id="payroll-slip-printable" className="p-4 bg-white border border-gray-200 rounded-2xl space-y-6 text-slate-800">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-gray-300 pb-4">
                  <div>
                    <h2 className="text-lg font-black text-indigo-700 tracking-tight">{currentEstablishment?.nom || 'Edu-Nify ERP'}</h2>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{currentEstablishment?.adresse || 'Complexe Scolaire Libre, Campus Principal'}</p>
                    <p className="text-[9px] text-gray-400">ID Établissement : {currentEstId}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 bg-indigo-50 border border-indigo-150 rounded text-indigo-750 text-[10px] font-black uppercase">
                      Bulletin de Paie Simplifié
                    </span>
                    <p className="text-xs font-mono font-bold mt-2 text-gray-805">Réf : {selectedSlip.slipNumber}</p>
                    <p className="text-[10px] text-gray-400">Émis le : {selectedSlip.dateGenerated}</p>
                  </div>
                </div>

                {/* Employee / Employer meta info */}
                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-xl border border-gray-100">
                  <div className="space-y-1">
                    <p className="text-[9px] text-gray-400 uppercase font-black tracking-wider">Employeur</p>
                    <p className="font-bold text-gray-800">{currentEstablishment?.nom || 'Edu-Nify'}</p>
                    <p className="text-[10px]">Service Comptabilité & Trésorerie</p>
                  </div>
                  <div className="space-y-1 border-l border-gray-200 pl-4">
                    <p className="text-[9px] text-gray-400 uppercase font-black tracking-wider">Collaborateur</p>
                    <p className="font-bold text-indigo-850">{selectedSlip.employeeName}</p>
                    <p className="text-[10px]">Profil : <span className="font-bold">{selectedSlip.employeeRole}</span></p>
                  </div>
                </div>

                {/* Payroll details grid */}
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200 bg-slate-100 font-bold text-gray-600 block-header">
                      <th className="py-2 px-3">Rubrique de Paye</th>
                      <th className="py-2 px-2 text-right">Part Gain (FCFA)</th>
                      <th className="py-2 px-2 text-right">Part Retenue (FCFA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono">
                    <tr>
                      <td className="py-2 px-3 text-slate-700">Salaire de Base Brut</td>
                      <td className="py-2 px-2 text-right text-slate-900 font-bold">{selectedSlip.baseSalary.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right text-gray-400">-</td>
                    </tr>
                    {selectedSlip.primes > 0 && (
                      <tr>
                        <td className="py-2 px-3 text-slate-705">Primes sur rendement & d'assiduité</td>
                        <td className="py-2 px-2 text-right text-slate-900 font-bold">{selectedSlip.primes.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-gray-400">-</td>
                      </tr>
                    )}
                    {selectedSlip.heuresSup > 0 && (
                      <tr>
                        <td className="py-2 px-3 text-slate-705">Heures Sup. ({selectedSlip.heuresSup} h à {selectedSlip.tauxHeureSup.toLocaleString()} F)</td>
                        <td className="py-2 px-2 text-right text-slate-900 font-bold">{(selectedSlip.heuresSup * selectedSlip.tauxHeureSup).toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-gray-400">-</td>
                      </tr>
                    )}
                    {selectedSlip.avances > 0 && (
                      <tr>
                        <td className="py-2 px-3 text-slate-705">Acompte / Avance sur salaire perçue</td>
                        <td className="py-2 px-2 text-right text-gray-400">-</td>
                        <td className="py-2 px-2 text-right text-rose-600 font-bold">{selectedSlip.avances.toLocaleString()}</td>
                      </tr>
                    )}
                    {selectedSlip.deductions > 0 && (
                      <tr>
                        <td className="py-2 px-3 text-slate-705">Déduction d'absence ou retard</td>
                        <td className="py-2 px-2 text-right text-gray-400">-</td>
                        <td className="py-2 px-2 text-right text-rose-600 font-bold">{selectedSlip.deductions.toLocaleString()}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-bold bg-indigo-50/60 font-sans">
                      <td className="py-2.5 px-3 uppercase text-[10px] text-gray-500 font-black">Totaux cumulés</td>
                      <td className="py-2.5 px-2 text-right text-slate-950 font-black font-mono">{selectedSlip.totalEarnings.toLocaleString()} F</td>
                      <td className="py-2.5 px-2 text-right text-rose-650 font-black font-mono">{selectedSlip.totalDeductions.toLocaleString()} F</td>
                    </tr>
                    <tr className="border-t-2 border-indigo-500 bg-indigo-600 text-white font-sans text-sm font-black">
                      <td className="py-3 px-3 uppercase tracking-wider text-[11px] font-black">Net à Payer (FCFA)</td>
                      <td colSpan={2} className="py-3 px-3 text-right font-mono font-black text-lg">
                        {selectedSlip.netSalary.toLocaleString()} FCFA
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Footer notes */}
                <div className="pt-4 border-t border-dashed border-gray-200 flex justify-between items-end text-[9px] text-gray-400 leading-snug">
                  <div>
                    <p className="font-bold">Mentions Obligatoires :</p>
                    <p>Pour faire valoir ce que de droit.</p>
                    <p>Les données de ce bulletin sont stockées de façon sécurisée en comptabilité OHADA.</p>
                  </div>
                  <div className="text-center w-40 border-t border-slate-300 pt-1">
                    <p className="font-semibold text-slate-750">Visa Direction Financière</p>
                    <div className="h-6 w-12 mx-auto border border-dashed border-slate-200 mt-1 opacity-40"></div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3.5">
                <button
                  onClick={() => setViewingSlipId(null)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs"
                >
                  Retour
                </button>
                <button
                  onClick={() => {
                    const printContents = document.getElementById('payroll-slip-printable')?.innerHTML;
                    const originalContents = document.body.innerHTML;
                    if (printContents) {
                      document.body.innerHTML = printContents;
                      window.print();
                      window.location.reload(); // Quick restore state
                    }
                  }}
                  className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-slate-905 font-black uppercase text-xs flex items-center gap-1.5 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  <Printer size={15} /> Imprimer le bulletin
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // B. ASSETS (IMMOBILISATIONS)
  if (activeTab === 'assets') {
    return (
      <div className="space-y-6">
        {/* Module Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-cyan-800 text-white p-6 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
            <span className="px-2.5 py-1 bg-white/10 rounded-md text-[10px] font-black uppercase tracking-wider">
              🏫 Classe 2: Actifs Immobilisés
            </span>
            <h2 className="text-xl font-bold mt-1.5 uppercase tracking-wide">Gestion des Immobilisations scolaires</h2>
            <p className="text-xs text-cyan-100 mt-1 font-sans">
              Enregistrez le patrimoine de l'établissement (bâtiments, ordinateurs, flottes de bus, mobiliers) et calculez l'amortissement.
            </p>
          </div>
          <button
            onClick={() => setShowAssetModal(true)}
            className="px-4 py-2.5 bg-white text-cyan-800 hover:bg-cyan-50 rounded-xl transition-all font-black uppercase text-[11px] flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={15} /> Saisir un Bien
          </button>
        </div>

        {/* Amortization schedule detailed drawer */}
        {selectedAssetForSchedule && (
          <div className="bg-indigo-50/50 dark:bg-gray-800 p-6 rounded-3xl border border-indigo-100 dark:border-gray-750 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-black text-indigo-600 dark:text-indigo-400 tracking-wider font-mono">
                  Calculateur Linear-Pro OHADA
                </span>
                <h4 className="text-sm font-black text-gray-905 dark:text-white uppercase">
                  Plan d'amortissement de : {selectedAssetForSchedule.name} ({selectedAssetForSchedule.acquisitionValue.toLocaleString()} FCFA)
                </h4>
              </div>
              <button
                onClick={() => setSelectedAssetForSchedule(null)}
                className="px-3 py-1 bg-slate-20 bg-slate-200 dark:bg-slate-700 rounded-lg text-[10px] font-bold text-slate-800 dark:text-slate-100"
              >
                Masquer
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-indigo-150 pb-1.5 text-[9px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wider font-mono">
                    <th className="py-2">Exercice Comptable (Année)</th>
                    <th className="py-2 text-right">V.N.C Début de Période (F)</th>
                    <th className="py-2 text-right">Annuité d'Amortissement (F)</th>
                    <th className="py-2 text-right">Cumul Amorti (F)</th>
                    <th className="py-2 text-right">V.N.C Fin de Période (F)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 font-mono text-gray-700 dark:text-gray-300">
                  {calculateAmortizationSchedule(selectedAssetForSchedule).map((sched, index) => (
                    <tr key={index} className="hover:bg-indigo-50/20">
                      <td className="py-2.5 font-bold">Année {sched.year}</td>
                      <td className="py-2.5 text-right">{sched.beginningVnc.toLocaleString()}</td>
                      <td className="py-2.5 text-right text-rose-500 font-bold">{sched.annuity.toLocaleString()}</td>
                      <td className="py-2.5 text-right">{sched.accumulated.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-bold text-slate-900 dark:text-slate-100">
                        {sched.endingVnc.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Existing Assets Registry */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-750">
          <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-wider mb-4">
            Registre du Patrimoine Immobilisé
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-150 pb-2 text-[10px] font-black uppercase text-gray-400">
                  <th className="py-2.5">Désignation du bien</th>
                  <th className="py-2.5">Catégorie</th>
                  <th className="py-2.5 font-mono">Valeur Initiale</th>
                  <th className="py-2.5 font-sans text-center">Durée & Taux</th>
                  <th className="py-2.5 text-right">Statut & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider">
                      Aucune immobilisation n'est enregistrée pour le moment.
                    </td>
                  </tr>
                ) : (
                  assets.map(asset => {
                    const buyYear = new Date(asset.acquisitionDate).getFullYear();
                    const currentYear = new Date().getFullYear();
                    const age = Math.max(0, currentYear - buyYear);
                    const isFullyAmortized = age >= asset.lifespan;

                    return (
                      <tr key={asset.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-750/30">
                        <td className="py-3.5">
                          <p className="font-bold text-gray-900 dark:text-white">{asset.name}</p>
                          <span className="text-[10px] text-gray-400 font-mono">Acquis le : {asset.acquisitionDate}</span>
                        </td>
                        <td className="py-3.5 text-gray-500 uppercase text-[10px] font-black tracking-wide">
                          {asset.category}
                        </td>
                        <td className="py-3.5 font-mono font-bold text-indigo-650 dark:text-indigo-400">
                          {asset.acquisitionValue.toLocaleString()} FCFA
                        </td>
                        <td className="py-3.5 text-center">
                          <p className="font-semibold">{asset.lifespan} ans</p>
                          <span className="text-[10px] text-gray-400 font-mono">({asset.rate || (100 / asset.lifespan)}% / an)</span>
                        </td>
                        <td className="py-3.5 text-right space-y-1">
                          {isFullyAmortized ? (
                            <span className="inline-block text-[9px] font-black uppercase px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full border border-rose-100">
                              ● Totalement Amorti (VNC = 0)
                            </span>
                          ) : (
                            <span className="inline-block text-[9px] font-black uppercase px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                              ● En cours d'amortissement
                            </span>
                          )}
                          <div>
                            <button
                              onClick={() => setSelectedAssetForSchedule(asset)}
                              className="text-[10px] font-bold text-indigo-600 hover:underline inline-flex items-center gap-1 mt-1 uppercase"
                            >
                              <ClipboardList size={11} /> Plan Linear
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ASSET CREATION MODAL */}
        {showAssetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 rounded-[30px] p-6 max-w-sm w-full space-y-4 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase">Saisir une Immobilisation</h3>
                <button onClick={() => setShowAssetModal(false)} className="text-gray-405 hover:text-gray-600">×</button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Désignation du bien</label>
                  <input
                    type="text"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    placeholder="Ex: Micro-Ordinateurs HP Intel i5"
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-105 dark:border-gray-800 text-xs text-gray-800 dark:text-gray-200 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Catégorie de bien (Classe 2)</label>
                  <select
                    value={assetCategory}
                    onChange={(e) => setAssetCategory(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-105 dark:border-gray-800 text-xs text-gray-808"
                  >
                    <option value="Bâtiments & Infrastructures">Bâtiments & Infrastructures</option>
                    <option value="Bus & flottes de transport">Bus & flottes de transport</option>
                    <option value="Matériel Pédagogique">Matériel Pédagogique (pupitres, bancs)</option>
                    <option value="Matériel Informatique & Réseau">Matériel Informatique & Réseau</option>
                    <option value="Imprimantes, photocopieurs">Imprimantes, photocopieurs</option>
                    <option value="Électroménager & divers">Électroménager & divers</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Valeur d'Acquisition (FCFA)</label>
                  <input
                    type="number"
                    value={acquisitionValue}
                    onChange={(e) => setAcquisitionValue(Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-105 dark:border-gray-800 text-xs text-gray-808 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Durée d'amortissement (ans)</label>
                  <input
                    type="number"
                    value={lifespan}
                    onChange={(e) => setLifespan(Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-105 dark:border-gray-800 text-xs text-gray-808 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Date d'Acquisition</label>
                  <input
                    type="date"
                    value={acquisitionDate}
                    onChange={(e) => setAcquisitionDate(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-105 dark:border-gray-800 text-xs text-gray-808 font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setShowAssetModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddAsset}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-black uppercase text-center"
                >
                  Ajouter au patrimoine
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // C. PARTNERS (FOURNISSEURS ET CLIENTS)
  if (activeTab === 'suppliers') {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-amber-600 to-amber-800 text-white p-6 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
            <span className="px-2.5 py-1 bg-white/10 rounded-md text-[10px] font-black uppercase tracking-wider">
              👥 Tiers - Classe 4
            </span>
            <h2 className="text-xl font-bold mt-1.5 uppercase tracking-wide">Gestion des Fournisseurs Etablissement</h2>
            <p className="text-xs text-amber-100 mt-1">
              Gérez les relations avec vos prestataires pour fournitures de bureaux, cantines scolaires, et travaux d'aménagement.
            </p>
          </div>
          <button
            onClick={() => setShowSupplierModal(true)}
            className="px-4 py-2.5 bg-white text-amber-805 hover:bg-amber-50 rounded-xl transition-all font-black uppercase text-[11px] flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={15} /> Saisir Fournisseur
          </button>
        </div>

        {/* Master details grid for tiers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-750">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              Prestataires & Fournisseurs Agréés
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-150 pb-2 text-[10px] font-black uppercase text-gray-400">
                    <th className="py-2.5">Etablissement / Nom</th>
                    <th className="py-2.5">Rubrique de Services</th>
                    <th className="py-2.5">Coordonnées / Email</th>
                    <th className="py-2.5 text-right">Transactions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider">
                        Aucun fournisseur n'est encore référencé pour ce campus scolaire.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map(sup => {
                      const supTx = supplierTransactions.filter(t => t.supplierId === sup.id);
                      const totalInvoiced = supTx.filter(t => t.type === 'invoice').reduce((s, t) => s + t.amount, 0);
                      const totalPaid = supTx.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);
                      const outstandingDebt = Math.max(0, totalInvoiced - totalPaid);

                      return (
                        <tr key={sup.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-750/30">
                          <td className="py-3.5">
                            <p className="font-bold text-gray-900 dark:text-white">{sup.name}</p>
                            <span className="text-[10px] text-gray-400 uppercase font-mono tracking-wider">Fournisseur d'écoles</span>
                          </td>
                          <td className="py-3.5 text-gray-550">
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-md">
                              {sup.service}
                            </span>
                          </td>
                          <td className="py-3.5">
                            <p className="font-medium text-slate-700">{sup.phone || 'Non renseigné'}</p>
                            <p className="text-[10px] text-gray-400">{sup.email || 'Pas d\'email'}</p>
                          </td>
                          <td className="py-3.5 text-right space-y-1">
                            <p className="font-bold uppercase text-[10px] text-gray-500">
                              Dette active : <span className="text-amber-750 font-mono font-black">{outstandingDebt.toLocaleString()} F</span>
                            </p>
                            <button
                              onClick={() => {
                                setSelectedSupplierForTx(sup);
                                setShowSupplierTxModal(true);
                              }}
                              className="text-[9px] bg-indigo-600 hover:bg-slate-905 text-white px-2 py-1 font-bold rounded uppercase shadow-sm transition"
                            >
                              Saisir Facture / Règlement
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-750">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              Derniers Mouvements Tiers
            </h3>

            <div className="space-y-3">
              {supplierTransactions.length === 0 ? (
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider py-8 text-center">
                  Aucune facture ou règlement tiers enregistré.
                </p>
              ) : (
                supplierTransactions.slice(0, 5).map(tx => (
                  <div key={tx.id} className="p-3 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-gray-850 dark:text-white">{tx.supplierName}</p>
                      <p className="text-[10px] text-gray-400">{tx.description?.slice(0, 30)}...</p>
                      <span className="text-[9px] font-mono font-bold text-gray-500">{tx.reference} ({tx.date})</span>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono font-black ${tx.type === 'invoice' ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {tx.type === 'invoice' ? '+' : '-'}{tx.amount.toLocaleString()} F
                      </p>
                      <span className="text-[9px] uppercase font-black text-gray-400">
                        {tx.type === 'invoice' ? 'Achat/Dette' : 'Règlement'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* SUPPLIER MODAL */}
        {showSupplierModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 rounded-[30px] p-6 max-w-sm w-full space-y-4 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase">Créer un Compte Fournisseur</h3>
                <button onClick={() => setShowSupplierModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Raison Sociale / Nom</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Ex: SOGARA Papèterie Gabon"
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-105 dark:border-gray-800 text-xs text-gray-808 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Sélectionner son Service</label>
                  <select
                    value={supplierService}
                    onChange={(e) => setSupplierService(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-105 dark:border-gray-800 text-xs text-gray-808"
                  >
                    <option value="Aménagement & Travaux">Aménagement & Travaux</option>
                    <option value="Livres & Manuels Scolaires">Livres & Manuels Scolaires</option>
                    <option value="Fournisseur Alimentaire (Cantine)">Fournisseur Alimentaire (Cantine)</option>
                    <option value="Matériel & Chaises de classe">Matériel & Chaises de classe</option>
                    <option value="Sécurité & Gardiennage">Sécurité & Gardiennage</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-404">Numéro de Téléphone</label>
                  <input
                    type="text"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    placeholder="Ex: +241 07 45 42 12"
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-105 dark:border-gray-800 text-xs text-gray-808"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Adresse Email Officielle</label>
                  <input
                    type="email"
                    value={supplierEmail}
                    onChange={(e) => setSupplierEmail(e.target.value)}
                    placeholder="contact@sogara.com"
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-105 dark:border-gray-800 text-xs text-gray-808"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Adresse Physique / Localisation</label>
                  <input
                    type="text"
                    value={supplierAddress}
                    onChange={(e) => setSupplierAddress(e.target.value)}
                    placeholder="Libreville, PK 8"
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-105 dark:border-gray-800 text-xs text-gray-808"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddSupplier}
                  className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-black uppercase text-center"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUPPLIER TRANSACTION REGISTER MODAL */}
        {showSupplierTxModal && selectedSupplierForTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 rounded-[30px] p-6 max-w-sm w-full space-y-4 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase text-center">Post-Opération Fournisseur</h3>
                <button onClick={() => setShowSupplierTxModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
              </div>

              <p className="text-xs text-gray-500 font-medium">
                Saisir un nouvel événement pour le fournisseur agréé : <strong>{selectedSupplierForTx.name}</strong>
              </p>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Type de Transaction</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
                    <button
                      onClick={() => setTxType('invoice')}
                      className={`py-2 text-xs font-black uppercase rounded-lg transition-all ${txType === 'invoice' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                      Facture (Achat/Dette)
                    </button>
                    <button
                      onClick={() => setTxType('payment')}
                      className={`py-2 text-xs font-black uppercase rounded-lg transition-all ${txType === 'payment' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                      Règlement (Acompte)
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Montant (FCFA)</label>
                  <input
                    type="number"
                    value={txAmount}
                    onChange={(e) => setTxAmount(Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-105 dark:border-gray-800 text-xs text-gray-808 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Description / Libellé de l'opération</label>
                  <input
                    type="text"
                    value={txDescription}
                    onChange={(e) => setTxDescription(e.target.value)}
                    placeholder="Achat de craies, balais et rames..."
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-105 dark:border-gray-800 text-xs text-gray-808 font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setShowSupplierTxModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddSupplierTx}
                  className="px-4 py-2 bg-indigo-650 text-white rounded-xl text-xs font-black uppercase"
                >
                  Post & Valider OHADA Ledger
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // D. SCHOLARSHIPS & DISCOUNTS (BOURSES ET REMISES COMPTABLES AUTOMATIQUES)
  if (activeTab === 'discounts') {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-6 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
            <span className="px-2.5 py-1 bg-white/10 rounded-md text-[10px] font-black uppercase tracking-wider">
              🎓 Aide Sociale & Bourses d'études
            </span>
            <h2 className="text-xl font-bold mt-1.5 uppercase tracking-wide">Gestion de Bourses et Abattements</h2>
            <p className="text-xs text-purple-100 mt-1">
              Configurez des réductions familiales, bourses d'excellence, remises exceptionnelles et imputez les remises directement en comptabilité scolaire.
            </p>
          </div>
          <button
            onClick={() => {
              if (estStudents.length === 0) {
                alert("Aucun élève rattaché à cet établissement. Enregistrez des élèves d'abord !");
                return;
              }
              setSelectedStudentForScholarship(estStudents[0].id);
              setShowScholarshipModal(true);
            }}
            className="px-4 py-2.5 bg-white text-purple-805 hover:bg-purple-50 rounded-xl transition-all font-black uppercase text-[11px] flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={15} /> Attribuer une bourse
          </button>
        </div>

        {/* Existing scholarships list */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-750">
          <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4">
            Registre des Boursiers de l'Etablissement
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-150 pb-2 text-[10px] font-black uppercase text-gray-400">
                  <th className="py-2.5">Matricule / Élève</th>
                  <th className="py-2.5">Catégorie d'Aide</th>
                  <th className="py-2.5 text-center">Abattement de scolarité</th>
                  <th className="py-2.5 text-right">Montant Déduit (F)</th>
                  <th className="py-2.5 text-right">Date d'Imputation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scholarships.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider">
                      Aucune bourse d'études ou remise n'a été attribuée aux élèves de ce campus.
                    </td>
                  </tr>
                ) : (
                  scholarships.map(sch => (
                    <tr key={sch.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-750/30">
                      <td className="py-3.5">
                        <p className="font-bold text-gray-950 dark:text-white">{sch.studentName}</p>
                        <span className="text-[10px] text-gray-400 font-mono font-bold">Matricule : {sch.matricule || 'N/A'}</span>
                      </td>
                      <td className="py-3.5">
                        <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          sch.type.includes('totale')
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                        }`}>
                          {sch.type.replace('_', ' ').toUpperCase()}
                        </span>
                        <p className="text-[10px] text-gray-450 mt-1 font-medium">{sch.notes?.slice(0, 45)}...</p>
                      </td>
                      <td className="py-3.5 text-center font-bold text-purple-650 font-mono">
                        {sch.percent}% de réduction
                      </td>
                      <td className="py-3.5 text-right font-mono font-black text-rose-600">
                        -{sch.deductedAmount.toLocaleString()} FCFA
                      </td>
                      <td className="py-3.5 text-right text-gray-500 font-medium">
                        {sch.dateApplied}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ATTRIBUTION AID MODAL */}
        {showScholarshipModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 rounded-[30px] p-6 max-w-sm w-full space-y-4 border border-gray-100 dark:border-gray-805">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase text-center">Attribuer une Bourse / Remise</h3>
                <button onClick={() => setShowScholarshipModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Élève Bénéficiaire</label>
                  <select
                    value={selectedStudentForScholarship}
                    onChange={(e) => setSelectedStudentForScholarship(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-808"
                  >
                    {estStudents.map(student => (
                      <option key={student.id} value={student.id}>
                        {student.prenom} {student.nom} (Classe : {student.classe || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Raison sociale / Nature</label>
                  <select
                    value={scholarshipType}
                    onChange={(e) => {
                      const type = e.target.value as any;
                      setScholarshipType(type);
                      if (type === 'bourse_totale') setScholarshipPercent(100);
                      else if (type === 'bourse_partielle') setScholarshipPercent(50);
                      else if (type === 'remise_familiale') setScholarshipPercent(25);
                      else if (type === 'remise_personnel') setScholarshipPercent(30);
                    }}
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-808"
                  >
                    <option value="bourse_partielle">Bourse d'Étude Partielle (Excellence)</option>
                    <option value="bourse_totale">Bourse d'Étude Totale (Excellence 100%)</option>
                    <option value="remise_familiale font-sans">Réduction Familiale (Fratrie)</option>
                    <option value="remise_personnel">Réduction Personnel de l'Établissement</option>
                    <option value="aide_exceptionnelle">Aide Exceptionnelle Sociale</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono">Taux de réduction d'inscription (%)</label>
                  <input
                    type="number"
                    value={scholarshipPercent}
                    onChange={(e) => setScholarshipPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                    min="0"
                    max="100"
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-800 text-xs font-black font-mono text-gray-808"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Notes justificatives</label>
                  <input
                    type="text"
                    value={scholarshipNotes}
                    onChange={(e) => setScholarshipNotes(e.target.value)}
                    placeholder="Évaluation sociale positive sous PV-0453"
                    className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-808"
                  />
                </div>
              </div>

              {/* automatic preview reduction valuation */}
              <div className="bg-slate-900 rounded-2xl p-4 text-white text-xs border border-white/10 space-y-1 text-center">
                <span className="text-gray-450 block uppercase tracking-wider text-[9px] font-bold">Imputation estimée en comptabilité scolaire</span>
                <p className="font-mono text-lg font-black text-purple-400">
                  -{((scholarshipPercent / 100) * 450000).toLocaleString()} FCFA
                </p>
                <span className="text-gray-400 font-serif">Avoir imputé automatiquement sur le registre des scolarités annuelles</span>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setShowScholarshipModal(false)}
                  className="px-4 py-2 bg-gray-105 text-gray-755 bg-gray-100 rounded-xl text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddScholarship}
                  className="px-4 py-2 bg-purple-605 bg-purple-600 text-white hover:bg-slate-905 rounded-xl text-xs font-black uppercase text-center"
                >
                  Imputer d'office
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};
