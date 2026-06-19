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
  // Principal / representative details (Proviseur / Principal / Directeur)
  responsableCivility?: 'M.' | 'Mme' | 'Dr' | 'Pr';
  responsableNom?: string;
  responsablePrenom?: string;
  responsableEmail?: string;
  responsableTelephone?: string;
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

const DEFAULT_ESTABLISHMENTS: Establishment[] = [];

export const EstablishmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [currentEstablishment, setCurrentEstablishment] = useState<Establishment | null>(null);
  const [activeEstablishmentId, setActiveEstablishmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if current user is global platform owner (Super Admin)
  const isSuperAdmin = currentUser?.email === 'martinienmvezogo@gmail.com' ||
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
