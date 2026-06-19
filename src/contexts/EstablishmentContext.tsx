import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

export interface Establishment {
  id: string; // e.g. "EDU-001"
  code: string;
  nom: string;
  logo: string;
  banner: string;
  devise: string;
  adresse: string;
  telephone: string;
  email: string;
  siteWeb: string;
  active: boolean;
  dateCreation: string;
  licence: string;
  plan: 'Basic' | 'Standard' | 'Premium' | 'Enterprise';
  primaryColor: string; // Hex code
  secondaryColor: string; // Hex code
  activeSchoolYear: string;
}

interface EstablishmentContextType {
  establishments: Establishment[];
  currentEstablishment: Establishment | null;
  activeEstablishmentId: string | null;
  changeActiveEstablishment: (id: string) => void;
  loading: boolean;
  isSuperAdmin: boolean;
  createEstablishment: (est: Omit<Establishment, 'dateCreation'>) => Promise<void>;
  updateEstablishment: (id: string, updates: Partial<Establishment>) => Promise<void>;
  toggleEstablishmentStatus: (id: string) => Promise<void>;
}

const EstablishmentContext = createContext<EstablishmentContextType | null>(null);

const DEFAULT_ESTABLISHMENTS: Establishment[] = [
  {
    id: 'EDU-001',
    code: 'EDU-001',
    nom: "Collège National d'Excellence",
    logo: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3', // school emblem
    banner: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    devise: 'Discipline, Travail, Succès',
    adresse: 'Bvd Triomphal, Libreville, Gabon',
    telephone: '+241 66 12 34 56',
    email: 'contact@excellence.edu',
    siteWeb: 'https://excellence.edu',
    active: true,
    dateCreation: '2024-01-15T08:00:00Z',
    licence: 'EDUNIFY-LUDO-EXCELLENCE-8821',
    plan: 'Premium',
    primaryColor: '#4f46e5', // Indigo
    secondaryColor: '#ea580c', // Orange
    activeSchoolYear: '2025-2026'
  },
  {
    id: 'EDU-002',
    code: 'EDU-002',
    nom: 'Institut Polytechnique Supérieur',
    logo: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3', // tech emblem
    banner: 'https://images.unsplash.com/photo-1562774053-701939374585?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    devise: 'Science, Innovation, Progrès',
    adresse: 'Zone Industrielle d Oloumi, Libreville',
    telephone: '+241 77 88 99 00',
    email: 'info@polytech.edu',
    siteWeb: 'https://polytech.edu',
    active: true,
    dateCreation: '2024-03-20T10:30:00Z',
    licence: 'EDUNIFY-LUDO-POLYTECH-9231',
    plan: 'Enterprise',
    primaryColor: '#059669', // Emerald
    secondaryColor: '#06b6d4', // Cyan
    activeSchoolYear: '2025-2026'
  },
  {
    id: 'EDU-003',
    code: 'EDU-003',
    nom: 'Lycée Privé de l Estuaire',
    logo: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3', // general logo
    banner: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    devise: 'Rigueur, Élite, Avenir',
    adresse: 'La Sablière, Libreville, Gabon',
    telephone: '+241 11 22 34 44',
    email: 'direction@estuaire.edu',
    siteWeb: 'https://estuaire.edu',
    active: true,
    dateCreation: '2024-05-10T09:00:00Z',
    licence: 'EDUNIFY-LUDO-ESTUAIRE-5114',
    plan: 'Standard',
    primaryColor: '#b91c1c', // Red
    secondaryColor: '#eab308', // Yellow/Gold
    activeSchoolYear: '2025-2026'
  },
  {
    id: 'EDU-004',
    code: 'EDU-004',
    nom: 'Centre de Formation Ludo Académie',
    logo: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    banner: 'https://images.unsplash.com/photo-1513258496099-48168024aec0?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    devise: 'Savoir-Faire et Savoir-Être',
    adresse: 'Bvd Triomphal, Libreville, Gabon',
    telephone: '+241 65 44 22 11',
    email: 'contact@ludo-academy.com',
    siteWeb: 'https://ludo-academy.com',
    active: false, // Suspended test case
    dateCreation: '2024-08-01T14:22:00Z',
    licence: 'EDUNIFY-LUDO-ACAD-4412',
    plan: 'Basic',
    primaryColor: '#7c3aed', // Purple
    secondaryColor: '#f43f5e', // Rose
    activeSchoolYear: '2025-2026'
  }
];

export const EstablishmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [currentEstablishment, setCurrentEstablishment] = useState<Establishment | null>(null);
  const [activeEstablishmentId, setActiveEstablishmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if current user is global platform owner
  const isSuperAdmin = currentUser?.role === 'admin' ||
                       currentUser?.email === 'martinienmvezogo@gmail.com' ||
                       currentUser?.email === 'ludo.consulting3@gmail.com';

  // Seed establishments if empty
  useEffect(() => {
    const seedIfNeeded = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'etablissements'));
        if (querySnapshot.empty) {
          console.log('Seeding default establishments inside Firestore...');
          for (const est of DEFAULT_ESTABLISHMENTS) {
            await setDoc(doc(db, 'etablissements', est.id), est);
          }
        }
      } catch (err) {
        console.error('Error seeding default establishments:', err);
      }
    };
    seedIfNeeded();
  }, []);

  // Listen to establishments collection in real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'etablissements'), (snapshot) => {
      const list: Establishment[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Establishment);
      });
      setEstablishments(list);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to etablissements:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Match the active establishment to user's assigned establishment or selected one
  useEffect(() => {
    if (establishments.length === 0) return;

    if (isSuperAdmin) {
      // Super admin can select which campus to view
      const selectedId = activeEstablishmentId || localStorage.getItem('active-tenant-id');
      const found = establishments.find(e => e.id === selectedId) || establishments.find(e => e.active) || establishments[0];
      setCurrentEstablishment(found);
      if (found && found.id !== activeEstablishmentId) {
        setActiveEstablishmentId(found.id);
        localStorage.setItem('active-tenant-id', found.id);
      }
    } else {
      // Normal users are strictly isolated to their assigned establishment field
      const userEtab = currentUser?.etablissement || 'EDU-001';
      const found = establishments.find(e => e.id === userEtab) || establishments.find(e => e.id === 'EDU-001') || establishments[0];
      setCurrentEstablishment(found);
      if (found) {
        setActiveEstablishmentId(found.id);
      }
    }
  }, [establishments, currentUser, activeEstablishmentId, isSuperAdmin]);

  // Inject CSS Variables for Dynamic Branding
  useEffect(() => {
    if (currentEstablishment) {
      const primary = currentEstablishment.primaryColor || '#4f46e5';
      const secondary = currentEstablishment.secondaryColor || '#ea580c';
      
      // Update HTML root style variables
      document.documentElement.style.setProperty('--color-primary-custom', primary);
      document.documentElement.style.setProperty('--color-secondary-custom', secondary);
      
      console.log(`Branding dynamically applied for: ${currentEstablishment.nom} (${primary} / ${secondary})`);
    }
  }, [currentEstablishment]);

  const changeActiveEstablishment = (id: string) => {
    if (!isSuperAdmin) return;
    setActiveEstablishmentId(id);
    localStorage.setItem('active-tenant-id', id);
  };

  const createEstablishment = async (est: Omit<Establishment, 'dateCreation'>) => {
    const newEst: Establishment = {
      ...est,
      dateCreation: new Date().toISOString()
    };
    await setDoc(doc(db, 'etablissements', est.id), newEst);
  };

  const updateEstablishment = async (id: string, updates: Partial<Establishment>) => {
    await setDoc(doc(db, 'etablissements', id), updates, { merge: true });
  };

  const toggleEstablishmentStatus = async (id: string) => {
    const target = establishments.find(e => e.id === id);
    if (!target) return;
    await setDoc(doc(db, 'etablissements', id), { active: !target.active }, { merge: true });
  };

  return (
    <EstablishmentContext.Provider
      value={{
        establishments,
        currentEstablishment,
        activeEstablishmentId,
        changeActiveEstablishment,
        loading,
        isSuperAdmin,
        createEstablishment,
        updateEstablishment,
        toggleEstablishmentStatus
      }}
    >
      {children}
    </EstablishmentContext.Provider>
  );
};

export const useEstablishment = () => {
  const context = useContext(EstablishmentContext);
  if (!context) {
    throw new Error('useEstablishment must be used within an EstablishmentProvider');
  }
  return context;
};
