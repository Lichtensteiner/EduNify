import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Baby, 
  BookOpen, 
  GraduationCap, 
  Wallet, 
  Users, 
  ShieldAlert, 
  Eye, 
  Check, 
  Trash2, 
  Plus, 
  FileText, 
  Calendar, 
  Laptop, 
  Clock, 
  Key, 
  Activity, 
  Sparkles, 
  FileCheck, 
  Phone, 
  Search, 
  TrendingUp, 
  CheckSquare, 
  AlertTriangle,
  Heart,
  FileBadge,
  Sparkle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { administrativeResponsibilities } from './Staff';

export default function ResponsibilityZones() {
  const { currentUser } = useAuth();
  const { t, tData } = useLanguage();
  const { notifySuccess, notifyError } = useNotification();

  // All administrative responsibility IDs that are available
  const availableResponsibilityIds = React.useMemo(() => {
    return administrativeResponsibilities.map(r => r.id);
  }, []);

  // Check which responsibilities are active for the logged-in user
  // If admin, they can manage and view ALL responsibilities EXCEPT 'responsable_maternelle' (Gestion de la Maternelle is removed from admin's Bureau Direction tabs)
  const isGlobalAdmin = currentUser?.role === 'admin';
  const userResponsibilities = currentUser?.responsibilities || [];
  
  const accessibleResponsibilityIds = React.useMemo(() => {
    return isGlobalAdmin 
      ? availableResponsibilityIds.filter(id => id !== 'responsable_maternelle') 
      : userResponsibilities;
  }, [isGlobalAdmin, availableResponsibilityIds, userResponsibilities]);

  const [activeRespId, setActiveRespId] = useState<string>('');

  const enforcePermission = (respId: string): boolean => {
    if (accessibleResponsibilityIds.includes(respId)) {
      return true;
    }
    notifyError("Sécurité : Action non autorisée pour vos responsabilités.");
    return false;
  };

  useEffect(() => {
    if (accessibleResponsibilityIds.length > 0) {
      if (!activeRespId || !accessibleResponsibilityIds.includes(activeRespId)) {
        setActiveRespId(accessibleResponsibilityIds[0]);
      }
    } else {
      setActiveRespId('');
    }
  }, [accessibleResponsibilityIds, activeRespId]);

  // Real-time states for Maternelle
  const [siestas, setSiestas] = useState<Array<{id: string, name: string, classroom: string, status: 'awake' | 'sleeping' | 'resting'}>>([]);
  const [maternelleTransmissions, setMaternelleTransmissions] = useState<Array<{id: string, kidName: string, notes: string, bottles: number, date: string}>>([]);

  // Subscribe to real-time Firestore updates for Maternelle
  useEffect(() => {
    if (!accessibleResponsibilityIds.includes('responsable_maternelle')) return;

    const unsubSiestas = onSnapshot(collection(db, 'maternelle_siestas'), (snapshot) => {
      if (snapshot.empty) {
        // Bootstrap default siestas if collection is empty
        const defaults = [
          { name: 'Léo Martin', classroom: 'Petite Section A', status: 'resting' },
          { name: 'Mia Kouao', classroom: 'Moyenne Section B', status: 'sleeping' },
          { name: 'Noé Dupont', classroom: 'Petite Section A', status: 'awake' },
        ];
        defaults.forEach(async (item) => {
          await addDoc(collection(db, 'maternelle_siestas'), item);
        });
      } else {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          classroom: doc.data().classroom,
          status: doc.data().status as 'awake' | 'sleeping' | 'resting'
        }));
        setSiestas(data);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'maternelle_siestas');
    });

    const unsubTransmissions = onSnapshot(collection(db, 'maternelle_transmissions'), (snapshot) => {
      if (snapshot.empty) {
        // Bootstrap default transmissions if collection is empty
        const defaults = [
          { kidName: 'Léo Martin', notes: 'A bien mangé à midi. Sieste calme de 1h30.', bottles: 2, date: 'Aujourd\'hui' }
        ];
        defaults.forEach(async (item) => {
          await addDoc(collection(db, 'maternelle_transmissions'), item);
        });
      } else {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          kidName: doc.data().kidName,
          notes: doc.data().notes,
          bottles: Number(doc.data().bottles || 0),
          date: doc.data().date
        }));
        setMaternelleTransmissions(data);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'maternelle_transmissions');
    });

    return () => {
      unsubSiestas();
      unsubTransmissions();
    };
  }, [accessibleResponsibilityIds]);

  // 2. Reading Challenge (Primaire) state
  const [readingProgress, setReadingProgress] = useState<Array<{id: string, name: string, booksRead: number, goal: number, rating: string}>>([]);
  const [primaryFieldTrips, setPrimaryFieldTrips] = useState<Array<{id: string, destination: string, date: string, status: 'approved' | 'pending' | 'rejected'}>>([]);

  // 3. College (Detentions & Brevet Chapters)
  const [collegeDetentions, setCollegeDetentions] = useState<Array<{id: string, student: string, reason: string, teacher: string, date: string, hour: string, proctor: string}>>([]);
  const [brevetChapters, setBrevetChapters] = useState<Array<{id: string, subject: string, topic: string, status: 'ready' | 'pending'}>>([]);

  // 4. Comptabilité Ledger Flow (Cash Flow ledger)
  const [accountingFlows, setAccountingFlows] = useState<Array<{id: string, type: 'inflow' | 'outflow', category: string, amount: number, description: string, date: string}>>([]);

  // 5. Pedagogique checks
  const [remedialGroups, setRemedialGroups] = useState<Array<{id: string, studentName: string, subject: string, level: string, date: string}>>([]);
  const [syllabusRates, setSyllabusRates] = useState<Array<{id: string, course: string, teacher: string, rate: number}>>([]);

  // 6. Surveillant Général
  const [lateSlips, setLateSlips] = useState<Array<{id: string, studentName: string, duration: number, reason: string, date: string, hasTicket: boolean}>>([]);

  // 7. Surveillant Adjoint
  const [visitorsLog, setVisitorsLog] = useState<Array<{id: string, visitorName: string, reason: string, targetPerson: string, entryTime: string, status: 'inside' | 'left'}>>([]);
  const [lockerKeys, setLockerKeys] = useState<Array<{id: string, lockerNo: string, student: string, date: string, returned: boolean}>>([]);

  // 8. Dame de ménage
  const [cleanZones, setCleanZones] = useState<Array<{id: string, zone: string, frequency: string, lastCleaned: string, status: 'cleaned' | 'pending'}>>([]);
  const [cleaningSupplies, setCleaningSupplies] = useState<Array<{id: string, item: string, stock: number, limit: number}>>([]);

  // 9. Secrétaire Générale
  const [dossiers, setDossiers] = useState<Array<{id: string, name: string, level: string, originSchool: string, status: 'pending' | 'accepted' | 'rejected'}>>([]);

  // 10. Secrétaire Adjointe
  const [phoneCalls, setPhoneCalls] = useState<Array<{id: string, caller: string, message: string, targetStudent: string, status: 'noted' | 'relayed'}>>([]);

  // 11. IT Admin
  const [itLoans, setItLoans] = useState<Array<{id: string, cartId: string, classTarget: string, duration: string, status: 'borrowed' | 'returned'}>>([]);
  const [itTickets, setItTickets] = useState<Array<{id: string, item: string, description: string, severity: 'minor' | 'critical', status: 'open' | 'investigating' | 'resolved'}>>([]);
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    // 2. Reading Challenge progress
    if (accessibleResponsibilityIds.includes('responsable_primaire')) {
      const unsubRp = onSnapshot(collection(db, 'resp_reading_progress'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { name: 'Arthur Durand', booksRead: 4, goal: 8, rating: 'Excellent' },
            { name: 'Chloé Konan', booksRead: 6, goal: 8, rating: 'Championne' },
            { name: 'Sébastien Diallo', booksRead: 2, goal: 8, rating: 'En progrès' },
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_reading_progress'), item);
          });
        } else {
          setReadingProgress(snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || '',
            booksRead: Number(doc.data().booksRead || 0),
            goal: Number(doc.data().goal || 8),
            rating: doc.data().rating || 'En progrès'
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_reading_progress'));
      unsubs.push(unsubRp);

      // Primary Field Trips
      const unsubFt = onSnapshot(collection(db, 'resp_field_trips'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { destination: 'Musée d\'Histoire Naturelle', date: '25 Mai 2026', status: 'pending' },
            { destination: 'Parc Botanique National', date: '12 Juin 2026', status: 'approved' }
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_field_trips'), item);
          });
        } else {
          setPrimaryFieldTrips(snapshot.docs.map(doc => ({
            id: doc.id,
            destination: doc.data().destination || '',
            date: doc.data().date || '',
            status: doc.data().status as any
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_field_trips'));
      unsubs.push(unsubFt);
    }

    // 3. College Detentions
    if (accessibleResponsibilityIds.includes('responsable_college')) {
      const unsubDet = onSnapshot(collection(db, 'resp_college_detentions'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { student: 'Marc Ehua', reason: 'Absences répétées non justifiées aux évaluations', teacher: 'M. Ella', date: '22 Mai 2026', hour: '14:00 - 16:00', proctor: 'M. Kouamé' }
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_college_detentions'), item);
          });
        } else {
          setCollegeDetentions(snapshot.docs.map(doc => ({
            id: doc.id,
            student: doc.data().student || '',
            reason: doc.data().reason || '',
            teacher: doc.data().teacher || '',
            date: doc.data().date || '',
            hour: doc.data().hour || '',
            proctor: doc.data().proctor || ''
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_college_detentions'));
      unsubs.push(unsubDet);

      // Brevet Chapters
      const unsubChapters = onSnapshot(collection(db, 'resp_brevet_chapters'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { subject: 'Mathématiques', topic: 'Arithmétique & PGCD', status: 'ready' },
            { subject: 'Histoire', topic: 'La Première Guerre Mondiale', status: 'ready' },
            { subject: 'Sciences', topic: 'Génétique & Évolution', status: 'pending' },
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_brevet_chapters'), item);
          });
        } else {
          setBrevetChapters(snapshot.docs.map(doc => ({
            id: doc.id,
            subject: doc.data().subject || '',
            topic: doc.data().topic || '',
            status: doc.data().status as any
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_brevet_chapters'));
      unsubs.push(unsubChapters);
    }

    // Accounting Flows
    if (accessibleResponsibilityIds.includes('gestionnaire_comptable')) {
      const unsubFlows = onSnapshot(collection(db, 'resp_accounting_flows'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { type: 'inflow', category: 'Écolages', amount: 480000, description: 'Scolarité Trimestre 3 - Classe de 3ème', date: 'Aujourd\'hui, 10:15' },
            { type: 'outflow', category: 'Fournitures', amount: 85000, description: 'Achat de craies et rames de papier', date: 'Hier, 16:30' },
            { type: 'inflow', category: 'Cantine', amount: 120000, description: 'Recharge cartes cantine - Parent Koné', date: 'Aujourd\'hui, 08:45' }
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_accounting_flows'), item);
          });
        } else {
          setAccountingFlows(snapshot.docs.map(doc => ({
            id: doc.id,
            type: doc.data().type as any,
            category: doc.data().category || '',
            amount: Number(doc.data().amount || 0),
            description: doc.data().description || '',
            date: doc.data().date || ''
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_accounting_flows'));
      unsubs.push(unsubFlows);
    }

    // Remedial Groups
    if (accessibleResponsibilityIds.includes('responsable_pedagogique')) {
      const unsubRem = onSnapshot(collection(db, 'resp_remedial_groups'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { studentName: 'Inès Bamba', subject: 'Physique-Chimie', level: '4ème A', date: 'Mercredi 15h' },
            { studentName: 'Arnaud Yao', subject: 'Mathématiques', level: '3ème B', date: 'Samedi 09h' }
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_remedial_groups'), item);
          });
        } else {
          setRemedialGroups(snapshot.docs.map(doc => ({
            id: doc.id,
            studentName: doc.data().studentName || '',
            subject: doc.data().subject || '',
            level: doc.data().level || '',
            date: doc.data().date || ''
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_remedial_groups'));
      unsubs.push(unsubRem);

      // Syllabus Rates
      const unsubSyllabus = onSnapshot(collection(db, 'resp_syllabus_rates'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { course: 'Mathématiques 3e', teacher: 'Armand Ella', rate: 82 },
            { course: 'Français 4e', teacher: 'Mme Touré', rate: 75 },
            { course: 'Anglais 5e', teacher: 'Ludovic Dev', rate: 90 },
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_syllabus_rates'), item);
          });
        } else {
          setSyllabusRates(snapshot.docs.map(doc => ({
            id: doc.id,
            course: doc.data().course || '',
            teacher: doc.data().teacher || '',
            rate: Number(doc.data().rate || 0)
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_syllabus_rates'));
      unsubs.push(unsubSyllabus);
    }

    // Late Slips
    if (accessibleResponsibilityIds.includes('surveillant_general')) {
      const unsubLates = onSnapshot(collection(db, 'resp_late_slips'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { studentName: 'Hervé Assi', duration: 25, reason: 'Panne de bus de ramassage', date: '21 Mai, 08:35', hasTicket: true }
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_late_slips'), item);
          });
        } else {
          setLateSlips(snapshot.docs.map(doc => ({
            id: doc.id,
            studentName: doc.data().studentName || '',
            duration: Number(doc.data().duration || 0),
            reason: doc.data().reason || '',
            date: doc.data().date || '',
            hasTicket: !!doc.data().hasTicket
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_late_slips'));
      unsubs.push(unsubLates);
    }

    // Visitors Log
    if (accessibleResponsibilityIds.includes('surveillant_adjoint')) {
      const unsubVisitors = onSnapshot(collection(db, 'resp_visitors_log'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { visitorName: 'M. Koffi Kouamé (Parent)', reason: 'Rendez-vous Principal', targetPerson: 'Mme le Proviseur', entryTime: '09:45', status: 'inside' },
            { visitorName: 'Technicien Orange CI', reason: 'Paneth Internet', targetPerson: 'Responsable IT', entryTime: '08:15', status: 'left' }
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_visitors_log'), item);
          });
        } else {
          setVisitorsLog(snapshot.docs.map(doc => ({
            id: doc.id,
            visitorName: doc.data().visitorName || '',
            reason: doc.data().reason || '',
            targetPerson: doc.data().targetPerson || '',
            entryTime: doc.data().entryTime || '',
            status: doc.data().status as any
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_visitors_log'));
      unsubs.push(unsubVisitors);

      // Locker Keys
      const unsubLocker = onSnapshot(collection(db, 'resp_locker_keys'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { lockerNo: 'C-42', student: 'Ismaël Cissé', date: '21 Mai', returned: false },
            { lockerNo: 'A-108', student: 'Mariam Sidibé', date: '19 Mai', returned: true }
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_locker_keys'), item);
          });
        } else {
          setLockerKeys(snapshot.docs.map(doc => ({
            id: doc.id,
            lockerNo: doc.data().lockerNo || '',
            student: doc.data().student || '',
            date: doc.data().date || '',
            returned: !!doc.data().returned
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_locker_keys'));
      unsubs.push(unsubLocker);
    }

    // Clean zones
    if (accessibleResponsibilityIds.includes('dame_menage')) {
      const unsubClean = onSnapshot(collection(db, 'resp_clean_zones'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { zone: 'Bloc Sanitaire Maternelle', frequency: 'Toutes les 2h', lastCleaned: '10:00 (Aujourd\'hui)', status: 'cleaned' },
            { zone: 'Réfectoire Cantine', frequency: 'Quotidien', lastCleaned: '14:30 (Hier)', status: 'pending' },
            { zone: 'Bibliothèque Centrale', frequency: 'Hebdomadaire', lastCleaned: '20 Mai, 16:00', status: 'cleaned' }
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_clean_zones'), item);
          });
        } else {
          setCleanZones(snapshot.docs.map(doc => ({
            id: doc.id,
            zone: doc.data().zone || '',
            frequency: doc.data().frequency || '',
            lastCleaned: doc.data().lastCleaned || '',
            status: doc.data().status as any
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_clean_zones'));
      unsubs.push(unsubClean);

      // Cleaning Supplies
      const unsubSupplies = onSnapshot(collection(db, 'resp_cleaning_supplies'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { item: 'Savon liquide mains', stock: 12, limit: 5 },
            { item: 'Eau de Javel (bidons 5L)', stock: 2, limit: 4 },
            { item: 'Papier essuie-tout', stock: 45, limit: 10 }
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_cleaning_supplies'), item);
          });
        } else {
          setCleaningSupplies(snapshot.docs.map(doc => ({
            id: doc.id,
            item: doc.data().item || '',
            stock: Number(doc.data().stock || 0),
            limit: Number(doc.data().limit || 0)
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_cleaning_supplies'));
      unsubs.push(unsubSupplies);
    }

    // Dossiers (Secrétaire Générale)
    if (accessibleResponsibilityIds.includes('secretaire_generale')) {
      const unsubDos = onSnapshot(collection(db, 'resp_dossiers'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { name: 'Alix Koné', level: 'Classe de Seconde C', originSchool: 'Collège Moderne Bouaké', status: 'pending' },
            { name: 'Sarah Beugré', level: 'Classe de 6ème', originSchool: 'EPP Plateau', status: 'accepted' }
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_dossiers'), item);
          });
        } else {
          setDossiers(snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || '',
            level: doc.data().level || '',
            originSchool: doc.data().originSchool || '',
            status: doc.data().status as any
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_dossiers'));
      unsubs.push(unsubDos);
    }

    // Phone Calls (Secrétaire Adjointe)
    if (accessibleResponsibilityIds.includes('secretaire_adjointe')) {
      const unsubCalls = onSnapshot(collection(db, 'resp_phone_calls'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { caller: 'Mme Martin (Maman de Léo)', message: 'Sera en retard de 15 minutes ce soir pour la sieste maternelle.', targetStudent: 'Léo Martin', status: 'noted' }
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_phone_calls'), item);
          });
        } else {
          setPhoneCalls(snapshot.docs.map(doc => ({
            id: doc.id,
            caller: doc.data().caller || '',
            message: doc.data().message || '',
            targetStudent: doc.data().targetStudent || '',
            status: doc.data().status as any
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_phone_calls'));
      unsubs.push(unsubCalls);
    }

    // IT Loans & Tickets
    if (accessibleResponsibilityIds.includes('responsable_it')) {
      const unsubLoans = onSnapshot(collection(db, 'resp_it_loans'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { cartId: 'Chariot Tablettes Android #2', classTarget: 'Terminales S-B', duration: 'Aujourd\'hui 08h - 12h', status: 'borrowed' }
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_it_loans'), item);
          });
        } else {
          setItLoans(snapshot.docs.map(doc => ({
            id: doc.id,
            cartId: doc.data().cartId || '',
            classTarget: doc.data().classTarget || '',
            duration: doc.data().duration || '',
            status: doc.data().status as any
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_it_loans'));
      unsubs.push(unsubLoans);

      // IT Tickets
      const unsubTickets = onSnapshot(collection(db, 'resp_it_tickets'), (snapshot) => {
        if (snapshot.empty) {
          const defaults = [
            { item: 'Vidéo-projecteur Salle Informatique 1', description: 'Lampe décolorée ou bruit de ventilation excessif', severity: 'minor', status: 'investigating' },
            { item: 'Borne Wifi Récréation Cour A', description: 'Pas de signal DHCP pour les badges biométriques', severity: 'critical', status: 'open' }
          ];
          defaults.forEach(async (item) => {
            await addDoc(collection(db, 'resp_it_tickets'), item);
          });
        } else {
          setItTickets(snapshot.docs.map(doc => ({
            id: doc.id,
            item: doc.data().item || '',
            description: doc.data().description || '',
            severity: doc.data().severity as any,
            status: doc.data().status as any
          })));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'resp_it_tickets'));
      unsubs.push(unsubTickets);
    }

    return () => {
      unsubs.forEach(cleanup => cleanup());
    };
  }, [accessibleResponsibilityIds]);

  // Form states
  const [formKidName, setFormKidName] = useState('');
  const [formKidClassroom, setFormKidClassroom] = useState('Petite Section A');
  const [formNotesText, setFormNotesText] = useState('');
  
  const [formReadingName, setFormReadingName] = useState('');
  const [formReadingLevel, setFormReadingLevel] = useState('En progrès');
  
  const [formDetStudent, setFormDetStudent] = useState('');
  const [formDetReason, setFormDetReason] = useState('');
  const [formDetProctor, setFormDetProctor] = useState('M. Kouamé');
  
  const [formLedgerType, setFormLedgerType] = useState<'inflow' | 'outflow'>('inflow');
  const [formLedgerPrice, setFormLedgerPrice] = useState('');
  const [formLedgerDesc, setFormLedgerDesc] = useState('');
  const [formLedgerCategory, setFormLedgerCategory] = useState('Écolages');

  const [formRemedialStudent, setFormRemedialStudent] = useState('');
  const [formRemedialSubject, setFormRemedialSubject] = useState('Mathématiques');
  const [formRemedialLevel, setFormRemedialLevel] = useState('3ème B');

  const [formLateName, setFormLateName] = useState('');
  const [formLateDuration, setFormLateDuration] = useState('15');
  const [formLateReason, setFormLateReason] = useState('');

  const [formVisitorName, setFormVisitorName] = useState('');
  const [formVisitorReason, setFormVisitorReason] = useState('');
  const [formVisitorTarget, setFormVisitorTarget] = useState('');

  const [formLockerNo, setFormLockerNo] = useState('');
  const [formLockerStudent, setFormLockerStudent] = useState('');

  const [formITItem, setFormITItem] = useState('');
  const [formITDesc, setFormITDesc] = useState('');
  const [formITSeverity, setFormITSeverity] = useState<'minor' | 'critical'>('minor');

  const [formDocName, setFormDocName] = useState('');
  const [formDocLevel, setFormDocLevel] = useState('Classe de 6ème');
  const [formDocOrigin, setFormDocOrigin] = useState('');

  const [formCallCaller, setFormCallCaller] = useState('');
  const [formCallMsg, setFormCallMsg] = useState('');
  const [formCallStudent, setFormCallStudent] = useState('');

  const activeRespData = administrativeResponsibilities.find(r => r.id === activeRespId);

  // Quick Stats count
  const inactiveOrUnauthorised = accessibleResponsibilityIds.length === 0;

  if (inactiveOrUnauthorised) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-gray-150 dark:border-gray-750 text-center px-4 max-w-lg mx-auto mt-10">
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-full mb-4">
          <ShieldAlert size={48} />
        </div>
        <h3 className="text-lg font-black text-gray-900 dark:text-white">Fonctions Coordonnées</h3>
        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
          Aucune responsabilité administrative ou de direction ne vous est attribuée pour le moment. 
          Les enseignants et personnels doivent être accrédités par un administrateur depuis l'onglet <strong>Personnel & Attribution</strong> pour piloter un service.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Upper Accoridian Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-150 dark:border-gray-750/60 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1 rounded-xl">
              Bureau Direction
            </span>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
              Tableaux de Pilotage Métiers
            </h1>
            <p className="text-xs text-gray-450 dark:text-gray-400 leading-snug">
              {isGlobalAdmin 
                ? "Compte Administrateur : Vous accédez aux 11 interfaces de pilotage administratif en temps réel." 
                : `Vous pilotez les ${accessibleResponsibilityIds.length} portails de direction qui vous ont été assignés.`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-gray-405 dark:text-gray-400 font-mono tracking-widest uppercase">System Operational: Live</span>
          </div>
        </div>

        {/* Selected switch buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          {administrativeResponsibilities
            .filter(r => accessibleResponsibilityIds.includes(r.id))
            .map(resp => {
              const isActive = activeRespId === resp.id;
              return (
                <button
                  key={resp.id}
                  onClick={() => setActiveRespId(resp.id)}
                  className={`px-3.5 py-2.5 rounded-2xl text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                    isActive 
                      ? `${resp.badgeBg} ring-2 ring-indigo-500/20 scale-[1.02] shadow-sm` 
                      : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-750 text-gray-500 hover:text-gray-900 border border-gray-100 dark:border-gray-750'
                  }`}
                >
                  <Sparkles size={11} className="opacity-70" />
                  {resp.label}
                </button>
              );
            })}
        </div>
      </div>

      {/* active board layout */}
      {activeRespData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Controls Panel (Left size 2cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Dashboard 1: Responsable de la Maternelle */}
            {activeRespId === 'responsable_maternelle' && (
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 border border-gray-150 dark:border-gray-750 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-105 dark:border-gray-700">
                  <div className="p-3.5 bg-pink-100 dark:bg-pink-905/20 text-pink-600 rounded-2xl">
                    <Baby size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Gestion de la Maternelle</h2>
                    <p className="text-xs text-gray-400">Siestes scolaires, fiches de liaison et transmissions pour les parents.</p>
                  </div>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 bg-pink-50/50 dark:bg-pink-950/10 rounded-2xl border border-pink-105/30 text-center">
                    <p className="text-[10px] uppercase font-black tracking-wider text-pink-500">Marmots Endormis</p>
                    <p className="text-2xl font-black text-pink-700 dark:text-pink-400 mt-1">
                      {siestas.filter(s => s.status === 'sleeping').length}
                    </p>
                  </div>
                  <div className="p-4 bg-amber-50/50 dark:bg-amber-950/10 rounded-2xl border border-amber-105/30 text-center">
                    <p className="text-[10px] uppercase font-black tracking-wider text-amber-500">Marmots au Repos</p>
                    <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">
                      {siestas.filter(s => s.status === 'resting').length}
                    </p>
                  </div>
                  <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-2xl border border-emerald-105/30 text-center">
                    <p className="text-[10px] uppercase font-black tracking-wider text-emerald-500">Marmots Réveillés</p>
                    <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                      {siestas.filter(s => s.status === 'awake').length}
                    </p>
                  </div>
                </div>

                {/* List siestas */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Suivi actif du sommeil (Temps Réel)</h3>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-900/30 overflow-hidden">
                    {siestas.map(kid => (
                      <div key={kid.id} className="p-3.5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white">{kid.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{kid.classroom}</p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700">
                          {(['awake', 'resting', 'sleeping'] as const).map(st => (
                            <button
                              key={st}
                              onClick={async () => {
                                if (!enforcePermission('responsable_maternelle')) return;
                                try {
                                  await updateDoc(doc(db, 'maternelle_siestas', kid.id), { status: st });
                                  notifySuccess(`Sommeil de ${kid.name} modifié !`);
                                } catch (error) {
                                  console.error("Error updating sleep status:", error);
                                }
                              }}
                              className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                                kid.status === st 
                                  ? st === 'awake' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/35'
                                    : st === 'resting' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/35'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/35'
                                  : 'text-gray-405 dark:text-gray-500 hover:bg-gray-100'
                              }`}
                            >
                              {st === 'awake' ? 'Réveillé' : st === 'resting' ? 'Repos' : 'Dort'}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Transmissions Logs for parents */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Dernières notes aux parents</h3>
                  <div className="space-y-2">
                    {maternelleTransmissions.map(trans => (
                      <div key={trans.id} className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2.5xl border border-gray-100 dark:border-gray-700/60 relative">
                        <div className="flex justify-between items-start">
                          <p className="text-xs font-extrabold text-pink-700 dark:text-pink-450">{trans.kidName}</p>
                          <span className="text-[9px] font-mono text-gray-400">{trans.date}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 italic">"{trans.notes}"</p>
                        <div className="flex items-center gap-1 mt-2">
                          <span className="text-[10px] font-black uppercase bg-pink-50 text-pink-650 px-2 py-0.5 rounded-md">
                            Biberons : {trans.bottles}
                          </span>
                        </div>
                        <button 
                          onClick={async () => {
                            if (!enforcePermission('responsable_maternelle')) return;
                            try {
                              await deleteDoc(doc(db, 'maternelle_transmissions', trans.id));
                              notifySuccess("Transmission supprimée !");
                            } catch (error) {
                              console.error("Error deleting transmission:", error);
                            }
                          }}
                          className="absolute right-3 bottom-3 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard 2: Responsable du Primaire */}
            {activeRespId === 'responsable_primaire' && (
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 border border-gray-150 dark:border-gray-750 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-105 dark:border-gray-700">
                  <div className="p-3.5 bg-sky-100 dark:bg-sky-905/20 text-sky-600 rounded-2xl">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Pilotage du Primaire</h2>
                    <p className="text-xs text-gray-400">Défi Lecture inter-classes, sorties éducatives et supervision du Cycle 2 & 3.</p>
                  </div>
                </div>

                {/* Readings progress table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Challenge National de Lecture</h3>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-900/30 overflow-hidden">
                    {readingProgress.map(student => (
                      <div key={student.id} className="p-4 flex items-center justify-between">
                        <div className="flex-1 pr-4">
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span>{student.name}</span>
                            <span className="text-indigo-600 dark:text-indigo-400">{student.booksRead} / {student.goal} livres</span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-500 rounded-full" style={{ width: `${(student.booksRead / student.goal) * 100}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-[9px] font-black uppercase tracking-widest rounded-lg">
                            {student.rating}
                          </span>
                          <button
                            onClick={async () => {
                              if (!enforcePermission('responsable_primaire')) return;
                              try {
                                const currentBooksRead = Number(student.booksRead || 0);
                                const currentGoal = Number(student.goal || 8);
                                const newRead = Math.min(currentBooksRead + 1, currentGoal);
                                const newRating = newRead >= currentGoal ? 'Légende' : 'En progrès';
                                await updateDoc(doc(db, 'resp_reading_progress', student.id), {
                                  booksRead: newRead,
                                  rating: newRating
                                });
                                notifySuccess(`Livre validé pour ${student.name} !`);
                              } catch (error) {
                                console.error("Error updating reading progress:", error);
                              }
                            }}
                            className="p-1.5 bg-white hover:bg-sky-50 dark:bg-gray-800 border border-gray-150 rounded-xl cursor-pointer"
                            title="Ajouter un livre lu"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Field trips */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Demandes de Sorties Scolaires</h3>
                  <div className="space-y-2">
                    {primaryFieldTrips.map(trip => (
                      <div key={trip.id} className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2.5xl border border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black text-gray-900 dark:text-white">{trip.destination}</p>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">Date prévue : {trip.date}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${
                            trip.status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 text-emerald-300'
                            : trip.status === 'rejected' ? 'bg-red-105 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                          }`}>
                            {trip.status === 'approved' ? 'Autorisé' : trip.status === 'rejected' ? 'Rejeté' : 'En examen'}
                          </span>
                          {trip.status === 'pending' && (
                            <div className="flex gap-1">
                              <button
                                onClick={async () => {
                                  if (!enforcePermission('responsable_primaire')) return;
                                  try {
                                    await updateDoc(doc(db, 'resp_field_trips', trip.id), {
                                      status: 'approved'
                                    });
                                    notifySuccess("Sortie de classe validée !");
                                  } catch (error) {
                                    console.error("Error approving field trip:", error);
                                  }
                                }}
                                className="p-1 bg-white hover:bg-emerald-50 text-emerald-600 rounded-lg border border-gray-150 cursor-pointer"
                              >
                                <Check size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard 3: Responsable Collège */}
            {activeRespId === 'responsable_college' && (
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 border border-gray-150 dark:border-gray-750 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-105 dark:border-gray-700">
                  <div className="p-3.5 bg-indigo-100 dark:bg-indigo-905/20 text-indigo-600 rounded-2xl">
                    <GraduationCap size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Pilotage du Collège (6e à 3e)</h2>
                    <p className="text-xs text-gray-400">Suivi des épreuves blanches du Brevet, discipline collective et ASSR.</p>
                  </div>
                </div>

                {/* Brevet exam completion checks */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Programme de révision Brevet Blanc</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {brevetChapters.map(chap => (
                      <div key={chap.id} className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2.5xl border border-gray-100 dark:border-gray-700/60 text-left relative overflow-hidden flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] uppercase font-black tracking-widest text-indigo-500 mt-1">{chap.subject}</p>
                          <p className="text-[11px] font-bold text-gray-800 dark:text-gray-300 mt-1.5 leading-tight">{chap.topic}</p>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className={`text-[9px] font-black uppercase ${chap.status === 'ready' ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {chap.status === 'ready' ? 'Prêt' : 'En attente'}
                          </span>
                          <button
                            onClick={async () => {
                              if (!enforcePermission('responsable_college')) return;
                              try {
                                const updatedStatus = chap.status === 'ready' ? 'pending' : 'ready';
                                await updateDoc(doc(db, 'resp_brevet_chapters', chap.id), {
                                  status: updatedStatus
                                });
                                notifySuccess("Statut du programme actualisé !");
                              } catch (error) {
                                console.error("Error updating chapter status:", error);
                              }
                            }}
                            className={`p-1 rounded-lg border text-[9px] font-black uppercase cursor-pointer ${
                              chap.status === 'ready' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-50 border-gray-150'
                            }`}
                          >
                            Bascule
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exclusion Detentions List */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Heures de Colle programmées</h3>
                  <div className="space-y-2">
                    {collegeDetentions.map(det => (
                      <div key={det.id} className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2.5xl border border-gray-100 dark:border-gray-700/60 relative">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-black text-gray-900 dark:text-white">{det.student}</p>
                            <p className="text-[9px] text-gray-400 mt-0.5">Saisi par : {det.teacher}</p>
                          </div>
                          <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 px-2.5 py-0.5 rounded-md font-bold">
                            {det.date} ({det.hour})
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-100 border-dashed">
                          <strong className="text-[10px] uppercase tracking-wider text-red-500 mr-1 block">Motif formel :</strong>
                          {det.reason}
                        </p>
                        <div className="mt-2.5 flex justify-between items-center text-[10px] text-gray-450 dark:text-gray-400">
                          <span>Surveillant : <strong>{det.proctor}</strong></span>
                          <button 
                            onClick={async () => {
                              if (!enforcePermission('responsable_college')) return;
                              try {
                                await deleteDoc(doc(db, 'resp_college_detentions', det.id));
                                notifySuccess("Ordre de retenue supprimé");
                              } catch (error) {
                                console.error("Error deleting detention:", error);
                              }
                            }}
                            className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all cursor-pointer"
                          >
                            Annuler l'ordre
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard 4: Gestionnaire Comptable */}
            {activeRespId === 'gestionnaire_comptable' && (
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 border border-gray-150 dark:border-gray-750 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-105 dark:border-gray-700">
                  <div className="p-3.5 bg-emerald-100 dark:bg-emerald-905/20 text-emerald-600 rounded-2xl">
                    <Wallet size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Relais Comptabilité & Balance</h2>
                    <p className="text-xs text-gray-400">Enregistrement des recettes directes, fournitures, salaires auxiliaires.</p>
                  </div>
                </div>

                {/* Ledger ledger list */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Journal d'écritures auxiliaires</h3>
                    <span className="text-[11px] text-emerald-600 font-bold border border-emerald-100 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-0.5 rounded-md">
                      Solde : {accountingFlows.reduce((acc, f) => f.type === 'inflow' ? acc + f.amount : acc - f.amount, 0).toLocaleString()} FCFA
                    </span>
                  </div>

                  <div className="space-y-2">
                    {accountingFlows.map(flow => (
                      <div key={flow.id} className="p-3.5 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`text-[11px] font-black uppercase w-4 h-4 rounded-full flex items-center justify-center ${
                            flow.type === 'inflow' ? 'text-emerald-500' : 'text-rose-500'
                          }`}>
                            {flow.type === 'inflow' ? '📈' : '📉'}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-gray-900 dark:text-white">{flow.description}</p>
                            <p className="text-[9px] text-gray-400 font-mono">Date : {flow.date} | Catégorie : {flow.category}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black ${flow.type === 'inflow' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {flow.type === 'inflow' ? '+' : '-'}{flow.amount.toLocaleString()} F
                          </span>
                          <button
                            onClick={async () => {
                              if (!enforcePermission('gestionnaire_comptable')) return;
                              try {
                                await deleteDoc(doc(db, 'resp_accounting_flows', flow.id));
                                notifySuccess("Écriture comptable supprimée !");
                              } catch (error) {
                                console.error("Error deleting flow:", error);
                              }
                            }}
                            className="p-1 text-gray-450 hover:text-red-500 rounded-md cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* tuition recovery checks */}
                <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-2.5xl border border-amber-100 dark:border-amber-900/30">
                  <div className="flex items-center gap-2 text-amber-850 dark:text-amber-300">
                    <AlertTriangle size={16} />
                    <h4 className="text-xs font-black uppercase tracking-wider">Écolages en souffrance (Actions requises)</h4>
                  </div>
                  <p className="text-[10px] text-amber-700/80 dark:text-amber-400 mt-1">
                    Il reste à ce jour <strong>14 élèves</strong> n'ayant pas soldé le 3ème trimestre. Relancer de manière prévenante.
                  </p>
                  <button
                    onClick={() => {
                      notifySuccess("Lettre de relance type simulée et prête pour le publipostage !");
                    }}
                    className="mt-3 px-3 py-1.5 bg-amber-655 hover:bg-amber-705 bg-amber-600 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                  >
                    Simuler un publipostage de relance
                  </button>
                </div>
              </div>
            )}

            {/* Dashboard 5: Responsable Pédagogique */}
            {activeRespId === 'responsable_pedagogique' && (
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 border border-gray-150 dark:border-gray-750 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-105 dark:border-gray-700">
                  <div className="p-3.5 bg-amber-100 dark:bg-amber-905/20 text-amber-600 rounded-2xl">
                    <GraduationCap size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Direction Pédagogique</h2>
                    <p className="text-xs text-gray-400">Progression des cahiers de textes, coordination des évaluations publiques.</p>
                  </div>
                </div>

                {/* Syllabus Audits Progress bars */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Progression globale des syllabi</h3>
                  <div className="space-y-3 bg-gray-50 dark:bg-gray-900/30 p-4 rounded-2.5xl border border-gray-150 dark:border-gray-750">
                    {syllabusRates.map(rateObj => (
                      <div key={rateObj.id}>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>{rateObj.course} ({rateObj.teacher})</span>
                          <span>{rateObj.rate}% complété</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={rateObj.rate}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setSyllabusRates(p => p.map(s => s.id === rateObj.id ? { ...s, rate: val } : s));
                            }}
                            onMouseUp={async (e) => {
                              if (!enforcePermission('responsable_pedagogique')) return;
                              const val = Number((e.target as HTMLInputElement).value);
                              try {
                                await updateDoc(doc(db, 'resp_syllabus_rates', rateObj.id), {
                                  rate: val
                                });
                              } catch (error) {
                                console.error("Error updating syllabus rate:", error);
                              }
                            }}
                            onTouchEnd={async (e) => {
                              if (!enforcePermission('responsable_pedagogique')) return;
                              const val = Number((e.target as HTMLInputElement).value);
                              try {
                                await updateDoc(doc(db, 'resp_syllabus_rates', rateObj.id), {
                                  rate: val
                                });
                              } catch (error) {
                                console.error("Error updating syllabus rate:", error);
                              }
                            }}
                            className="flex-1 accent-indigo-600 cursor-pointer"
                          />
                          <span className="text-[10px] text-indigo-505 font-black">{rateObj.rate >= 90 ? '🌟 Parfait' : '⏳ En cours'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Remedial groups scheduler */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Groupes de Soutien & Remédiation</h3>
                  <div className="space-y-2">
                    {remedialGroups.map(rem => (
                      <div key={rem.id} className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{rem.studentName}</p>
                          <p className="text-[10px] text-gray-455 dark:text-gray-400">Soutien {rem.subject} | Niveau: {rem.level}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-gray-400 font-bold bg-white dark:bg-gray-800 border border-gray-105 px-2 py-0.5 rounded-lg">
                            {rem.date}
                          </span>
                          <button
                            onClick={async () => {
                              if (!enforcePermission('responsable_pedagogique')) return;
                              try {
                                await deleteDoc(doc(db, 'resp_remedial_groups', rem.id));
                                notifySuccess("Groupe de soutien annulé !");
                              } catch (error) {
                                console.error("Error deleting remedial group:", error);
                              }
                            }}
                            className="text-gray-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard 6: Surveillant Général */}
            {activeRespId === 'surveillant_general' && (
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 border border-gray-150 dark:border-gray-750 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-105 dark:border-gray-700">
                  <div className="p-3.5 bg-red-105 bg-red-100 text-red-650 rounded-2xl">
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Direction de la Discipline Scolaire</h2>
                    <p className="text-xs text-gray-400">Enregistrement des exclusions, billets de retard officiels et proctoring.</p>
                  </div>
                </div>

                {/* Interactive Delay Slip Generator */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Billets de retard émis aujourd'hui</h3>
                  <div className="space-y-2">
                    {lateSlips.map(slip => (
                      <div key={slip.id} className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2.5xl border border-gray-100 dark:border-gray-700/60 relative">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-black text-red-750 dark:text-red-400">{slip.studentName}</p>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">Motif : {slip.reason}</p>
                          </div>
                          <span className="text-[10px] font-mono font-black text-red-650 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-lg border border-red-100">
                            +{slip.duration} Minutes
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">Émis le: {slip.date}</p>
                        
                        <div className="absolute right-3 bottom-3 flex gap-2">
                          <button
                            onClick={() => {
                              notifySuccess(`Billet d'entrée ré-imprimé pour ${slip.studentName} !`);
                            }}
                            className="text-[9px] font-black uppercase tracking-wider text-gray-500 bg-white border px-2 py-0.5 rounded-md cursor-pointer"
                          >
                            Imprimer
                          </button>
                          <button
                            onClick={async () => {
                              if (!enforcePermission('surveillant_general')) return;
                              try {
                                await deleteDoc(doc(db, 'resp_late_slips', slip.id));
                                notifySuccess("Billet de retard supprimé !");
                              } catch (error) {
                                console.error("Error deleting late slip:", error);
                              }
                            }}
                            className="text-gray-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard 7: Surveillant Adjoint */}
            {activeRespId === 'surveillant_adjoint' && (
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 border border-gray-150 dark:border-gray-750 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-105 dark:border-gray-700">
                  <div className="p-3.5 bg-orange-100 text-orange-650 rounded-2xl">
                    <Eye size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Surveillance de Proximité & Portails</h2>
                    <p className="text-xs text-gray-405">Contrôle d'accès des visiteurs de l'école et consignes des clefs de casiers.</p>
                  </div>
                </div>

                {/* Gate log controller */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Registre des entrées portails</h3>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-900/30 overflow-hidden">
                    {visitorsLog.map(vis => (
                      <div key={vis.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-extrabold text-gray-850 dark:text-gray-300">{vis.visitorName}</p>
                          <p className="text-[10px] text-gray-450 dark:text-gray-400">Sujet : {vis.reason} | Reçu par : {vis.targetPerson}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${
                            vis.status === 'inside' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-150 text-gray-500'
                          }`}>
                            {vis.status === 'inside' ? 'Sur Place' : 'Sorti'}
                          </span>
                          {vis.status === 'inside' && (
                            <button
                              onClick={async () => {
                                if (!enforcePermission('surveillant_adjoint')) return;
                                try {
                                  await updateDoc(doc(db, 'resp_visitors_log', vis.id), {
                                    status: 'left'
                                  });
                                  notifySuccess("Heure de sortie enregistrée !");
                                } catch (error) {
                                  console.error("Error leaving visitor:", error);
                                }
                              }}
                              className="text-[9px] bg-white text-gray-600 border px-2 py-0.5 rounded cursor-pointer"
                            >
                              Valider Sortie
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Locker loans keys */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Consignation Clefs Casiers Élèves</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {lockerKeys.map(lock => (
                      <div key={lock.id} className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">Casier {lock.lockerNo}</p>
                          <p className="text-[9px] text-gray-450 dark:text-gray-400">Attribué à: {lock.student}</p>
                        </div>
                        <button
                          onClick={async () => {
                            if (!enforcePermission('surveillant_adjoint')) return;
                            try {
                              const updatedRet = !lock.returned;
                              await updateDoc(doc(db, 'resp_locker_keys', lock.id), {
                                returned: updatedRet
                              });
                              notifySuccess(updatedRet ? "Clef restituée !" : "Clef prêtée à nouveau !");
                            } catch (error) {
                              console.error("Error updating locker key:", error);
                            }
                          }}
                          className={`px-2 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg border cursor-pointer ${
                            lock.returned 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                              : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}
                        >
                          {lock.returned ? 'Restituée' : 'Perdue/En Cours'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard 8: Dame de ménage */}
            {activeRespId === 'dame_menage' && (
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 border border-gray-150 dark:border-gray-750 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-105 dark:border-gray-700">
                  <div className="p-3.5 bg-teal-100 text-teal-650 rounded-2xl">
                    <Activity size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Pilotage de la Salubrité</h2>
                    <p className="text-xs text-gray-400">Suivi hebdomadaire de la désinfection des locaux, commandes de fournitures de propreté.</p>
                  </div>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-teal-50/50 dark:bg-teal-950/10 rounded-2xl border border-teal-105/30 text-left">
                    <p className="text-[10px] uppercase font-black tracking-wider text-teal-600">Locaux Désinfectés</p>
                    <p className="text-xl font-black text-teal-700 dark:text-teal-400 mt-1">
                      {cleanZones.filter(z => z.status === 'cleaned').length} / {cleanZones.length}
                    </p>
                  </div>
                  <div className="p-4 bg-red-50/50 dark:bg-red-950/10 rounded-2xl border border-red-105/30 text-left">
                    <p className="text-[10px] uppercase font-black tracking-wider text-red-500">Alertes Ruptures Produits</p>
                    <p className="text-xl font-black text-red-750 dark:text-red-400 mt-1">
                      {cleaningSupplies.filter(s => s.stock <= s.limit).length} Alerte(s)
                    </p>
                  </div>
                </div>

                {/* Clean progress checks */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Registre du plan hygiène</h3>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-900/30 overflow-hidden">
                    {cleanZones.map(zoneObj => (
                      <div key={zoneObj.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-extrabold text-gray-850 dark:text-gray-300">{zoneObj.zone}</p>
                          <p className="text-[9px] text-gray-455 dark:text-gray-400">Dernier passage : {zoneObj.lastCleaned} | Fréquence : {zoneObj.frequency}</p>
                        </div>
                        <button
                          onClick={async () => {
                            if (!enforcePermission('dame_menage')) return;
                            try {
                              const updatedSt = zoneObj.status === 'cleaned' ? 'pending' : 'cleaned';
                              await updateDoc(doc(db, 'resp_clean_zones', zoneObj.id), {
                                status: updatedSt,
                                lastCleaned: 'À l\'instant'
                              });
                              notifySuccess("Passage validé !");
                            } catch (error) {
                              console.error("Error updating clean zone:", error);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all cursor-pointer ${
                            zoneObj.status === 'cleaned' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}
                        >
                          {zoneObj.status === 'cleaned' ? 'Propre 🟢' : 'En Attente 🟡'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Products alerts list */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Commande express de produits de propreté</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {cleaningSupplies.map(supp => {
                      const isLow = supp.stock <= supp.limit;
                      return (
                        <div key={supp.id} className={`p-3 rounded-2xl border text-left ${
                          isLow ? 'bg-red-50/50 border-red-150' : 'bg-gray-50 dark:bg-gray-900/40 border-gray-100'
                        }`}>
                          <p className="text-[11px] font-extrabold text-gray-800 dark:text-gray-300">{supp.item}</p>
                          <p className="text-[10px] text-gray-405 mt-0.5">Stock: <strong>{supp.stock}</strong> (Minimum: {supp.limit})</p>
                          <button
                            onClick={async () => {
                              if (!enforcePermission('dame_menage')) return;
                              try {
                                const currentStock = Number(supp.stock || 0);
                                await updateDoc(doc(db, 'resp_cleaning_supplies', supp.id), {
                                  stock: currentStock + 10
                                });
                                notifySuccess("Dotation de stock commandée !");
                              } catch (error) {
                                console.error("Error updating stock supply:", error);
                              }
                            }}
                            className={`w-full mt-2.5 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg border text-center cursor-pointer ${
                              isLow ? 'bg-red-655 bg-red-600 text-white' : 'bg-white text-gray-600'
                            }`}
                          >
                            Recommander +10
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard 9: Secrétaire Générale */}
            {activeRespId === 'secretaire_generale' && (
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 border border-gray-150 dark:border-gray-750 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-105 dark:border-gray-700">
                  <div className="p-3.5 bg-purple-100 text-purple-650 rounded-2xl">
                    <FileBadge size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Secrétariat Général de l'Établissement</h2>
                    <p className="text-xs text-gray-400">Demandes de scolarisation, immatriculation des nouveaux élèves du registre.</p>
                  </div>
                </div>

                {/* Candidate dossiers registrations */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Suivi d'inscription des dossiers de candidature</h3>
                  <div className="space-y-2">
                    {dossiers.map(dos => (
                      <div key={dos.id} className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2.5xl border border-gray-100 dark:border-gray-750 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black text-gray-900 dark:text-white">{dos.name}</p>
                          <p className="text-[10px] text-gray-455 dark:text-gray-400">Niveau visé : {dos.level} | Établissement précédent : {dos.originSchool}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            dos.status === 'accepted' ? 'bg-emerald-100 text-emerald-800'
                            : dos.status === 'rejected' ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                          }`}>
                            {dos.status === 'accepted' ? 'Inscrit' : dos.status === 'rejected' ? 'Refusé' : 'En Saisie'}
                          </span>
                          {dos.status === 'pending' && (
                            <div className="flex gap-1">
                              <button
                                onClick={async () => {
                                  if (!enforcePermission('secretaire_generale')) return;
                                  try {
                                    await updateDoc(doc(db, 'resp_dossiers', dos.id), {
                                      status: 'accepted'
                                    });
                                    notifySuccess("Dossier de candidature validé et inscrit !");
                                  } catch (error) {
                                    console.error("Error accepting dossier:", error);
                                  }
                                }}
                                className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-bold border cursor-pointer"
                              >
                                Accepter
                              </button>
                              <button
                                onClick={async () => {
                                  if (!enforcePermission('secretaire_generale')) return;
                                  try {
                                    await updateDoc(doc(db, 'resp_dossiers', dos.id), {
                                      status: 'rejected'
                                    });
                                    notifySuccess("Candidature rejetée.");
                                  } catch (error) {
                                    console.error("Error rejecting dossier:", error);
                                  }
                                }}
                                className="px-2 py-1 bg-white hover:bg-red-50 text-red-700 rounded-lg text-[9px] font-bold border cursor-pointer"
                              >
                                Rejeter
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard 10: Secrétaire Adjointe */}
            {activeRespId === 'secretaire_adjointe' && (
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 border border-gray-150 dark:border-gray-750 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-105 dark:border-gray-700">
                  <div className="p-3.5 bg-fuchsia-100 text-fuchsia-650 rounded-2xl">
                    <Phone size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Secrétariat Adjoint / Secrétariat d'Accueil</h2>
                    <p className="text-xs text-gray-400">Registre des appels téléphoniques reçus pour transmission externe.</p>
                  </div>
                </div>

                {/* Telephone message log list */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Journal des Messages d'Appels Reçus</h3>
                  <div className="space-y-2">
                    {phoneCalls.map(call => (
                      <div key={call.id} className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2.5xl border border-gray-100 dark:border-gray-700/60 relative">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-black text-fuchsia-750 dark:text-fuchsia-400">{call.caller}</p>
                            <span className="text-[9px] font-mono text-gray-405">À transmettre à : <strong>{call.targetStudent}</strong></span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            call.status === 'relayed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {call.status === 'relayed' ? 'Transmis' : 'En Attente'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 italic bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-100 border-dashed">
                          "{call.message}"
                        </p>
                        
                        <div className="mt-2 text-right">
                          {call.status === 'noted' && (
                            <button
                              onClick={async () => {
                                if (!enforcePermission('secretaire_adjointe')) return;
                                try {
                                  await updateDoc(doc(db, 'resp_phone_calls', call.id), {
                                    status: 'relayed'
                                  });
                                  notifySuccess("Statut du message : Transmis à l'enseignant !");
                                } catch (error) {
                                  console.error("Error relaying phone call:", error);
                                }
                              }}
                              className="text-[9px] font-black uppercase tracking-wider text-white bg-fuchsia-600 px-3 py-1 rounded-lg cursor-pointer align-middle"
                            >
                              Marquer Transmis
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              if (!enforcePermission('secretaire_adjointe')) return;
                              try {
                                  await deleteDoc(doc(db, 'resp_phone_calls', call.id));
                                  notifySuccess("Message supprimé !");
                              } catch (error) {
                                console.error("Error deleting phone call:", error);
                              }
                            }}
                            className="text-gray-400 hover:text-red-500 ml-2 text-xs cursor-pointer align-middle"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard 11: Responsable Informatique */}
            {activeRespId === 'responsable_it' && (
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 border border-gray-150 dark:border-gray-750 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-105 dark:border-gray-700">
                  <div className="p-3.5 bg-cyan-100 text-cyan-650 rounded-2xl">
                    <Laptop size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Gestion du Matériel Informatique</h2>
                    <p className="text-xs text-gray-400">Suivi des parcs mobiles de tablettes, réservation de matériel pédagogique et tickets d'incidents.</p>
                  </div>
                </div>

                {/* tablet loads table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Prêts actifs de valises numériques</h3>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-900/30 overflow-hidden">
                    {itLoans.map(loan => (
                      <div key={loan.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-extrabold text-cyan-700 dark:text-cyan-400">{loan.cartId}</p>
                          <p className="text-[10px] text-gray-450 dark:text-gray-400">Classe cible : {loan.classTarget} | Période : {loan.duration}</p>
                        </div>
                        <button
                          onClick={async () => {
                            if (!enforcePermission('responsable_it')) return;
                            try {
                              const newStatus = loan.status === 'borrowed' ? 'returned' : 'borrowed';
                              await updateDoc(doc(db, 'resp_it_loans', loan.id), {
                                status: newStatus
                              });
                              notifySuccess(newStatus === 'returned' ? "Chariot de tablettes restitué au labo IT !" : "Chariot marqué sorti !");
                            } catch (error) {
                              console.error("Error updating IT loan:", error);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all cursor-pointer ${
                            loan.status === 'returned' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                              : 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse'
                          }`}
                        >
                          {loan.status === 'returned' ? 'Restitué 🟢' : 'En Cours 🔴'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* IT tickets reporting */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Tickets d'incidents techniques en cours</h3>
                  <div className="space-y-2">
                    {itTickets.map(tick => (
                      <div key={tick.id} className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2.5xl border border-gray-100 dark:border-gray-700/60 relative">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-black text-gray-850 dark:text-gray-300">{tick.item}</p>
                            <p className="text-[10px] text-gray-455 mt-0.5 leading-snug">{tick.description}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            tick.severity === 'critical' ? 'bg-red-105 bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {tick.severity === 'critical' ? 'Critique' : 'Mineur'}
                          </span>
                        </div>
                        
                        <div className="mt-3 flex items-center justify-between text-[10px] text-gray-455">
                          <span>Statut : <strong>{tick.status.toUpperCase()}</strong></span>
                          <div className="flex gap-1">
                            <button
                              onClick={async () => {
                                if (!enforcePermission('responsable_it')) return;
                                try {
                                  await updateDoc(doc(db, 'resp_it_tickets', tick.id), {
                                    status: 'resolved'
                                  });
                                  notifySuccess("Ticket marqué Résolu !");
                                } catch (error) {
                                  console.error("Error resolving IT ticket:", error);
                                }
                              }}
                              className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-600 border rounded-lg text-[9px] cursor-pointer"
                            >
                              Marquer Résolu
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Interactive Form Panel (Right size 1col) */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Quick Action Forms */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 border border-gray-150 dark:border-gray-750 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                <Plus size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-black text-xs uppercase tracking-wider text-gray-900 dark:text-white">
                  Ajouter un Enregistrement
                </h3>
              </div>

              {/* Form 1: Maternelle */}
              {activeRespId === 'responsable_maternelle' && (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!enforcePermission('responsable_maternelle')) return;
                    if (!formKidName.trim()) return;
                    
                    try {
                      await addDoc(collection(db, 'maternelle_transmissions'), {
                        kidName: formKidName,
                        notes: formNotesText || 'Enfant calme et joyeux.',
                        bottles: 2,
                        date: 'À l\'instant'
                      });
                      
                      setFormKidName('');
                      setFormNotesText('');
                      notifySuccess("Note de transmission parents enregistrée !");
                    } catch (error) {
                      console.error("Error adding transmission:", error);
                    }
                  }}
                  className="space-y-3 text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Nom de l'Enfant</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Emma Kouassi"
                      value={formKidName}
                      onChange={(e) => setFormKidName(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border rounded-xl outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Remarques de Transmission</label>
                    <textarea 
                      placeholder="Sieste de 2h, repas complet mangé, selles OK..."
                      rows={3}
                      value={formNotesText}
                      onChange={(e) => setFormNotesText(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border rounded-xl outline-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-black uppercase text-[10px] tracking-wider transition-all"
                  >
                    Publier Note Parent
                  </button>
                </form>
              )}

              {/* Form 2: Primaire */}
              {activeRespId === 'responsable_primaire' && (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!enforcePermission('responsable_primaire')) return;
                    if (!formReadingName.trim()) return;
                    
                    try {
                      await addDoc(collection(db, 'resp_reading_progress'), {
                        name: formReadingName,
                        booksRead: 0,
                        goal: 8,
                        rating: formReadingLevel
                      });
                      setFormReadingName('');
                      notifySuccess("Élève inscrit au Challenge Lecture !");
                    } catch (error) {
                      console.error("Error adding reading progress:", error);
                    }
                  }}
                  className="space-y-3 text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Nom de l'élève</label>
                    <input 
                      type="text" 
                      placeholder="Ex: David Soro"
                      value={formReadingName}
                      onChange={(e) => setFormReadingName(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border rounded-xl outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Niveau de départ</label>
                    <select
                      value={formReadingLevel}
                      onChange={(e) => setFormReadingLevel(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border rounded-xl outline-none"
                    >
                      <option value="En progrès">En progrès</option>
                      <option value="Excellent">Excellent</option>
                      <option value="Champion/ne">Champion/ne</option>
                    </select>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer"
                  >
                    Inscrire au Challenge
                  </button>
                </form>
              )}

              {/* Form 3: College */}
              {activeRespId === 'responsable_college' && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!enforcePermission('responsable_college')) return;
                    if (!formDetStudent.trim() || !formDetReason.trim()) return;

                    try {
                      await addDoc(collection(db, 'resp_college_detentions'), {
                        student: formDetStudent,
                        reason: formDetReason,
                        teacher: currentUser?.prenom || 'Direction',
                        date: '23 Mai 2026',
                        hour: '13h30 - 15h30',
                        proctor: formDetProctor
                      });
                      setFormDetStudent('');
                      setFormDetReason('');
                      notifySuccess("Ordre de retenue officiellement émis !");
                    } catch (error) {
                      console.error("Error adding college detention:", error);
                    }
                  }}
                  className="space-y-3 text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Élève Consigné</label>
                    <input 
                      type="text" 
                      placeholder="Nom complet"
                      value={formDetStudent}
                      onChange={(e) => setFormDetStudent(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border rounded-xl outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Motif Disciplinaire</label>
                    <textarea 
                      placeholder="Bavardages incessants malgré avertissements, etc."
                      rows={2}
                      value={formDetReason}
                      onChange={(e) => setFormDetReason(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border rounded-xl outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Surveillant de permanence</label>
                    <select
                      value={formDetProctor}
                      onChange={(e) => setFormDetProctor(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border rounded-xl outline-none"
                    >
                      <option value="M. Kouamé">M. Kouamé</option>
                      <option value="Mme Touré">Mme Touré</option>
                      <option value="Service Permanence">Service Permanence</option>
                    </select>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer"
                  >
                    Générer et Imprimer
                  </button>
                </form>
              )}

              {/* Form 4: Comptabilité */}
              {activeRespId === 'gestionnaire_comptable' && (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!enforcePermission('gestionnaire_comptable')) return;
                    if (!formLedgerDesc.trim() || !formLedgerPrice) return;
                    
                    try {
                      await addDoc(collection(db, 'resp_accounting_flows'), {
                        type: formLedgerType,
                        category: formLedgerCategory,
                        amount: Number(formLedgerPrice),
                        description: formLedgerDesc,
                        date: 'À l\'instant'
                      });
                      setFormLedgerDesc('');
                      setFormLedgerPrice('');
                      notifySuccess("Ligne comptable consignée !");
                    } catch (error) {
                      console.error("Error adding accounting flow:", error);
                    }
                  }}
                  className="space-y-3 text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400 font-bold block">Type d'opération</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        type="button" 
                        onClick={() => setFormLedgerType('inflow')}
                        className={`py-1.5 border rounded-lg text-center font-bold font-black uppercase text-[10px] cursor-pointer ${
                          formLedgerType === 'inflow' ? 'bg-emerald-50 text-emerald-700 border-emerald-500' : 'text-gray-400'
                        }`}
                      >
                        Recette (+)
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setFormLedgerType('outflow')}
                        className={`py-1.5 border rounded-lg text-center font-bold font-black uppercase text-[10px] cursor-pointer ${
                          formLedgerType === 'outflow' ? 'bg-rose-50 text-rose-700 border-rose-500' : 'text-gray-400'
                        }`}
                      >
                        Achat / Frais (-)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400 font-bold">Catégorie</label>
                    <select
                      value={formLedgerCategory}
                      onChange={(e) => setFormLedgerCategory(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl"
                    >
                      <option value="Écolages">Écolages (Frais sco)</option>
                      <option value="Encas">Fournitures administrative</option>
                      <option value="Cantine">Recharge Canteen</option>
                      <option value="Matériel">Équipements & IT</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Montant (FCFA)</label>
                    <input 
                      type="number" 
                      placeholder="Ex: 150000"
                      value={formLedgerPrice}
                      onChange={(e) => setFormLedgerPrice(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Candidat ou Objet précis</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Frais scolarité Touré 6ème B"
                      value={formLedgerDesc}
                      onChange={(e) => setFormLedgerDesc(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-[10px] cursor-pointer"
                  >
                    Valider Écriture Ledger
                  </button>
                </form>
              )}

              {/* Form 5: Pedagogique */}
              {activeRespId === 'responsable_pedagogique' && (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!enforcePermission('responsable_pedagogique')) return;
                    if (!formRemedialStudent.trim()) return;

                    try {
                      await addDoc(collection(db, 'resp_remedial_groups'), {
                        studentName: formRemedialStudent,
                        subject: formRemedialSubject,
                        level: formRemedialLevel,
                        date: 'Mercredi 14h30'
                      });
                      setFormRemedialStudent('');
                      notifySuccess("Élève inscrit au soutien scolaire !");
                    } catch (error) {
                      console.error("Error adding remedial group:", error);
                    }
                  }}
                  className="space-y-3 text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Élève en difficulté</label>
                    <input 
                      type="text" 
                      placeholder="Arthur Traoré"
                      value={formRemedialStudent}
                      onChange={(e) => setFormRemedialStudent(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Matière Soutien</label>
                    <select
                      value={formRemedialSubject}
                      onChange={(e) => setFormRemedialSubject(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl"
                    >
                      <option value="Mathématiques">Mathématiques</option>
                      <option value="Physique-Chimie">Physique-Chimie</option>
                      <option value="Français">Français</option>
                    </select>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase cursor-pointer"
                  >
                    Ouvrir un groupe de soutien
                  </button>
                </form>
              )}

              {/* Form 6: Surveillant General */}
              {activeRespId === 'surveillant_general' && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!enforcePermission('surveillant_general')) return;
                    if (!formLateName.trim() || !formLateReason.trim()) return;

                    try {
                      await addDoc(collection(db, 'resp_late_slips'), {
                        studentName: formLateName,
                        duration: Number(formLateDuration),
                        reason: formLateReason,
                        date: 'Aujourd\'hui',
                        hasTicket: true
                      });
                      setFormLateName('');
                      setFormLateReason('');
                      notifySuccess("Billet de retard officiel généré !");
                    } catch (error) {
                      console.error("Error adding late slip:", error);
                    }
                  }}
                  className="space-y-3 text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Élève en retard</label>
                    <input 
                      type="text" 
                      placeholder="Nom complet"
                      value={formLateName}
                      onChange={(e) => setFormLateName(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Minutes de Retard</label>
                    <select
                      value={formLateDuration}
                      onChange={(e) => setFormLateDuration(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl outline-none"
                    >
                      <option value="15">15 Minutes</option>
                      <option value="30">30 Minutes</option>
                      <option value="45">45 Minutes</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Raison formelle</label>
                    <input 
                      type="text" 
                      placeholder="Panne de réveil, embouteillages..."
                      value={formLateReason}
                      onChange={(e) => setFormLateReason(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl outline-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-red-600 text-white rounded-xl font-black uppercase tracking-wider text-[10px] transition-all cursor-pointer"
                  >
                    Émettre le Billet
                  </button>
                </form>
              )}

              {/* Form 7: Surveillant Adjoint */}
              {activeRespId === 'surveillant_adjoint' && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!enforcePermission('surveillant_adjoint')) return;
                    if (!formVisitorName.trim() || !formVisitorReason.trim()) return;

                    try {
                      await addDoc(collection(db, 'resp_visitors_log'), {
                        visitorName: formVisitorName,
                        reason: formVisitorReason,
                        targetPerson: formVisitorTarget || 'Direction',
                        entryTime: 'À l\'instant',
                        status: 'inside'
                      });
                      setFormVisitorName('');
                      setFormVisitorReason('');
                      setFormVisitorTarget('');
                      notifySuccess("Enregistrement du visiteur portail avec succès !");
                    } catch (error) {
                      console.error("Error adding visitor:", error);
                    }
                  }}
                  className="space-y-3 text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Identité du Visiteur</label>
                    <input 
                      type="text" 
                      placeholder="Nom, Société, etc."
                      value={formVisitorName}
                      onChange={(e) => setFormVisitorName(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Motif de visite</label>
                    <input 
                      type="text" 
                      placeholder="Livraison, Entretien parent..."
                      value={formVisitorReason}
                      onChange={(e) => setFormVisitorReason(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-[10px] uppercase cursor-pointer"
                  >
                    Ouvrir Accès Barrière
                  </button>
                </form>
              )}

              {/* Form 8: Dame Ménage */}
              {activeRespId === 'dame_menage' && (
                <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-100 text-center">
                  <p className="text-xs font-bold text-teal-700">Audit de salubrité</p>
                  <p className="text-[10px] text-gray-450 mt-1">Vous pouvez réclamer du matériel ou déclarer un dysfonctionnement de plomberie directement au service IT / Administrative de l'école.</p>
                  <button
                    onClick={async () => {
                      if (!enforcePermission('dame_menage')) return;
                      try {
                        await addDoc(collection(db, 'resp_it_tickets'), {
                          item: 'Incident Plomberie (Sanitaires ou blocs)',
                          description: 'Dysfonctionnement de plomberie signalé par la Dame de Ménage.',
                          severity: 'minor',
                          status: 'open'
                        });
                        notifySuccess("Alerte plomberie transmise de manière prévenante !");
                      } catch (error) {
                        console.error("Error declaring plomberie incident:", error);
                      }
                    }}
                    className="w-full mt-3 py-2 bg-teal-600 text-white rounded-xl font-black text-[10px] uppercase cursor-pointer"
                  >
                    Déclarer un Incident Plomberie
                  </button>
                </div>
              )}

              {/* Form 9: Secretaire Generale */}
              {activeRespId === 'secretaire_generale' && (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!enforcePermission('secretaire_generale')) return;
                    if (!formDocName.trim() || !formDocOrigin.trim()) return;

                    try {
                      await addDoc(collection(db, 'resp_dossiers'), {
                        name: formDocName,
                        level: formDocLevel,
                        originSchool: formDocOrigin,
                        status: 'pending'
                      });
                      setFormDocName('');
                      setFormDocOrigin('');
                      notifySuccess("Candidature encodée sur le registre !");
                    } catch (error) {
                      console.error("Error adding dossier:", error);
                    }
                  }}
                  className="space-y-3 text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Candidat Nom complet</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Kouassi Jean"
                      value={formDocName}
                      onChange={(e) => setFormDocName(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400 font-bold">Établissement de provenance</label>
                    <input 
                      type="text" 
                      placeholder="Lycée municipal..."
                      value={formDocOrigin}
                      onChange={(e) => setFormDocOrigin(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-purple-600 text-white rounded-xl font-black text-[10px] uppercase cursor-pointer"
                  >
                    Enregistrer Candidature
                  </button>
                </form>
              )}

              {/* Form 10: Secretaire Adjointe */}
              {activeRespId === 'secretaire_adjointe' && (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!enforcePermission('secretaire_adjointe')) return;
                    if (!formCallCaller.trim() || !formCallMsg.trim()) return;

                    try {
                      await addDoc(collection(db, 'resp_phone_calls'), {
                        caller: formCallCaller,
                        message: formCallMsg,
                        targetStudent: formCallStudent || 'Néant',
                        status: 'noted'
                      });
                      setFormCallCaller('');
                      setFormCallMsg('');
                      setFormCallStudent('');
                      notifySuccess("Message téléphonique consigné !");
                    } catch (error) {
                      console.error("Error adding phone call:", error);
                    }
                  }}
                  className="space-y-3 text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Correspondant & N°</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Banque de l'Habitat CI"
                      value={formCallCaller}
                      onChange={(e) => setFormCallCaller(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Message écrit</label>
                    <textarea 
                      placeholder="Urgent : Demande de certificat scolaire pour dossier de crédit."
                      rows={2}
                      value={formCallMsg}
                      onChange={(e) => setFormCallMsg(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-fuchsia-600 text-white rounded-xl font-black text-[10px] uppercase cursor-pointer"
                  >
                    Consigner Appel
                  </button>
                </form>
              )}

              {/* Form 11: IT Material */}
              {activeRespId === 'responsable_it' && (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!enforcePermission('responsable_it')) return;
                    if (!formITItem.trim() || !formITDesc.trim()) return;

                    try {
                      await addDoc(collection(db, 'resp_it_tickets'), {
                        item: formITItem,
                        description: formITDesc,
                        severity: formITSeverity,
                        status: 'open'
                      });
                      setFormITItem('');
                      setFormITDesc('');
                      notifySuccess("Incident informatique consigné !");
                    } catch (error) {
                      console.error("Error adding IT ticket:", error);
                    }
                  }}
                  className="space-y-3 text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Matériel défaillant</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Ordinateur portable Salle 4"
                      value={formITItem}
                      onChange={(e) => setFormITItem(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Symptômes relevés</label>
                    <textarea 
                      placeholder="Ne s'allume plus après mise à jour..."
                      rows={2}
                      value={formITDesc}
                      onChange={(e) => setFormITDesc(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-440">Gravité</label>
                    <select
                      value={formITSeverity}
                      onChange={(e) => setFormITSeverity(e.target.value as any)}
                      className="w-full p-2.5 bg-gray-50 border rounded-xl outline-none"
                    >
                      <option value="minor">Mineure (Simple bug)</option>
                      <option value="critical">Critique (Bloquant cours)</option>
                    </select>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-cyan-600 text-white rounded-xl font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer"
                  >
                    Créer Incident Ticket
                  </button>
                </form>
              )}

            </div>

            {/* General Advice and Mission statement */}
            <div className="bg-slate-900 text-slate-100 rounded-[2.5rem] p-6 border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center gap-2">
                <Sparkle className="text-amber-400 animate-spin" size={16} />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fiche de Poste & Missions</h4>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Chaque action que vous entreprenez sur cette interface est sauvegardée et transmise aux rapports d'activités opérationnelles de l'établissement pour assurer la transparence et la bonne marche de l'école.
              </p>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
