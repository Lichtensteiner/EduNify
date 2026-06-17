import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { db, auth, isFirebaseConfigured } from '../lib/firebase';
import { initSessionTracking, stopSessionTracking } from '../lib/sessionTracker';

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: 'admin' | 'enseignant' | 'élève' | 'personnel administratif' | 'parent' | 'cuisinier';
  preciseRole?: string;
  mustChangePassword?: boolean;
  temporaryPassword?: string;
  etablissement?: string;
  responsibilities?: string[];
  children_ids?: string[];
  classe?: string;
  classes?: string[];
  matiere?: string;
  matieres?: string[];
  matricule?: string;
  contact?: string;
  address?: string;
  gender?: 'male' | 'female' | 'other' | 'not_specified';
  diploma?: string;
  experience_years?: number;
  age?: number;
  photo?: string;
  cover?: string;
  cover_photo?: string;
  date_creation?: string;
  face_id?: string | null;
  fingerprint_id?: string | null;
  house_id?: string;
  position?: string;
  department?: string;
  biographie?: string;
  status?: 'online' | 'offline';
  lastSeen?: any;
  chatBlocked?: boolean;
  accessBlocked?: boolean;
  blockedUsers?: string[];
  notifications?: {
    push: boolean;
    email: boolean;
    sms: boolean;
    urgent: boolean;
  };
}

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, mdp: string) => Promise<void>;
  register: (data: Omit<User, 'id' | 'date_creation' | 'face_id' | 'fingerprint_id'>, mdp: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Safety timeout to prevent permanent white screen if Firebase hangs
    const timeout = setTimeout(() => {
      setIsInitializing(prev => {
        if (prev) {
          console.warn("Auth initialization timeout reached - forcing app to load");
          return false;
        }
        return prev;
      });
    }, 8000); // 8 seconds safety margin

    if (!isFirebaseConfigured) {
      setIsInitializing(false);
      clearTimeout(timeout);
      return;
    }
    
    let unsubscribeDoc: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser ? "User logged in" : "No user");
      if (unsubscribeDoc) unsubscribeDoc();

      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        console.log("Fetching user profile for UID:", firebaseUser.uid);
        
        // Update status to online when auth state changes to logged in
        setDoc(docRef, {
          status: 'online',
          lastSeen: serverTimestamp()
        }, { merge: true }).catch(err => console.error("Error updating online status:", err));

        unsubscribeDoc = onSnapshot(docRef, (docSnap) => {
          console.log("User profile snapshot received. Exists:", docSnap.exists());
          if (docSnap.exists()) {
            const rawData = docSnap.data() || {};
            const rawRole = rawData.role || 'élève';
            const normRole = getNormalizedRole(rawRole);
            const preciseRole = rawData.preciseRole || rawRole;
            
            const userData = {
              ...rawData,
              role: normRole,
              preciseRole: preciseRole
            } as any;
            
            // Auto-fill admin/teacher email check
            const isAdminEmail = firebaseUser.email === 'martinienmvezogo@gmail.com';
            
            if (isAdminEmail && userData.role !== 'admin') {
              console.log("Upgrading user to admin role based on email...");
              setDoc(docRef, { role: 'admin' }, { merge: true }).catch(err => console.error(err));
              setCurrentUser({ id: docSnap.id, ...userData, role: 'admin' } as User);
            } else if (firebaseUser.email === 'martinienmvezogo@gmail.com' && (!userData.prenom || !userData.nom)) {
              console.log("Auto-filling admin name...");
              const updateData = { prenom: 'Martinien', nom: 'Mvezogo' };
              setDoc(docRef, updateData, { merge: true }).catch(err => console.error(err));
              setCurrentUser({ id: docSnap.id, ...userData, ...updateData } as User);
            } else {
              const isLudo = firebaseUser.email === 'ludo.consulting3@gmail.com';
              if (isLudo && (!userData.responsibilities || userData.responsibilities.length === 0 || userData.role !== 'personnel administratif')) {
                console.log("Enriching Ludovic profile with admin roles...");
                const defaultResps = userData.responsibilities && userData.responsibilities.length > 0
                  ? userData.responsibilities
                  : ['gestionnaire_comptable', 'responsable_it', 'responsable_college', 'responsable_pedagogique'];
                const updatedRole = 'personnel administratif';
                setDoc(docRef, { 
                  responsibilities: defaultResps,
                  role: updatedRole
                }, { merge: true }).catch(err => console.error(err));
                setCurrentUser({ id: docSnap.id, ...userData, role: updatedRole, responsibilities: defaultResps } as User);
              } else {
                // If it is any personnel administratif with empty responsibilities but has a position, auto-map!
                if (userData.role === 'personnel administratif' && (!userData.responsibilities || userData.responsibilities.length === 0) && userData.position) {
                  const mappedResps = mapPositionToResponsibility(userData.position);
                  if (mappedResps.length > 0) {
                    setDoc(docRef, { responsibilities: mappedResps }, { merge: true }).catch(err => console.error(err));
                    setCurrentUser({ id: docSnap.id, ...userData, responsibilities: mappedResps } as User);
                  } else {
                    setCurrentUser({ id: docSnap.id, ...userData } as User);
                  }
                } else {
                  setCurrentUser({ id: docSnap.id, ...userData } as User);
                }
              }
            }
          } else {
            console.log("User profile does not exist in Firestore.");
            // Auto-create admin document if it doesn't exist
            if (firebaseUser.email === 'martinienmvezogo@gmail.com') {
              console.log("Creating admin profile...");
              const adminData = {
                email: firebaseUser.email,
                role: 'admin',
                prenom: 'Martinien',
                nom: 'Mvezogo',
                status: 'online',
                lastSeen: serverTimestamp(),
                date_creation: new Date().toISOString()
              };
              setDoc(docRef, adminData).catch(err => console.error("Error creating admin doc:", err));
              setCurrentUser({ id: firebaseUser.uid, ...adminData } as User);
            } else if (firebaseUser.email === 'ludo.consulting3@gmail.com') {
              console.log("Creating default administrative profile for Ludovic...");
              const adminStaffData = {
                email: firebaseUser.email,
                role: 'personnel administratif',
                prenom: 'Ludovic',
                nom: 'Consulting',
                responsibilities: ['gestionnaire_comptable', 'responsable_it', 'responsable_college', 'responsable_pedagogique'],
                status: 'online',
                lastSeen: serverTimestamp(),
                date_creation: new Date().toISOString()
              };
              setDoc(docRef, adminStaffData).catch(err => console.error("Error creating staff doc:", err));
              setCurrentUser({ id: firebaseUser.uid, ...adminStaffData } as User);
            } else {
              setCurrentUser(null);
              signOut(auth).catch(err => console.error("Error signing out deleted user:", err));
            }
          }
          console.log("Auth initialization complete.");
          setIsInitializing(false);
          clearTimeout(timeout);
        }, (err) => {
          console.error("Erreur lors de la récupération du profil:", err);
          setCurrentUser(null);
          setIsInitializing(false);
          clearTimeout(timeout);
        });
      } else {
        setCurrentUser(null);
        setIsInitializing(false);
        clearTimeout(timeout);
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  // Handle visibility change for presence
  useEffect(() => {
    if (!currentUser || !isFirebaseConfigured) return;

    const handleVisibilityChange = () => {
      const docRef = doc(db, 'users', currentUser.id);
      if (document.visibilityState === 'visible') {
        setDoc(docRef, {
          status: 'online',
          lastSeen: serverTimestamp()
        }, { merge: true }).catch(err => console.error(err));
      } else {
        setDoc(docRef, {
          status: 'offline',
          lastSeen: serverTimestamp()
        }, { merge: true }).catch(err => console.error(err));
      }
    };

    const handleBeforeUnload = () => {
      const docRef = doc(db, 'users', currentUser.id);
      setDoc(docRef, {
        status: 'offline',
        lastSeen: serverTimestamp()
      }, { merge: true }).catch(err => console.error(err));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Initialize real-time session tracking
    if (currentUser) {
      initSessionTracking(currentUser);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser]);

  const login = async (email: string, mdp: string) => {
    if (!isFirebaseConfigured) throw new Error("Firebase non configuré");
    setLoading(true);
    
    const isDefaultAdmin = email.toLowerCase().trim() === 'martinienmvezogo@gmail.com' && mdp === 'password';
    
    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email.trim(), mdp);
      } catch (signInErr: any) {
        if (isDefaultAdmin && (
          signInErr.code === 'auth/user-not-found' || 
          signInErr.code === 'auth/invalid-credential' || 
          signInErr.code === 'auth/wrong-password' || 
          (signInErr.message && (
            signInErr.message.includes('invalid-credential') || 
            signInErr.message.includes('user-not-found')
          ))
        )) {
          console.log("Auto-creating default admin in Auth system...");
          userCredential = await createUserWithEmailAndPassword(auth, email.trim(), mdp);
        } else {
          throw signInErr;
        }
      }
      // Log connection
      try {
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          let nom = userData.nom;
          let prenom = userData.prenom;
          
          if (email === 'martinienmvezogo@gmail.com' && (!prenom || !nom)) {
            prenom = 'Martinien';
            nom = 'Mvezogo';
          } else if (email === 'ludo.consulting3@gmail.com' && (!prenom || !nom)) {
            prenom = 'Ludo';
            nom = 'Consulting';
          }
          
          await addDoc(collection(db, 'connections'), {
            user_id: userCredential.user.uid,
            nom: nom,
            prenom: prenom,
            email: userData.email || email,
            role: userData.role || (email === 'martinienmvezogo@gmail.com' ? 'admin' : userData.role),
            timestamp: new Date().toISOString()
          });
        } else if (email === 'martinienmvezogo@gmail.com') {
          await addDoc(collection(db, 'connections'), {
            user_id: userCredential.user.uid,
            nom: 'Mvezogo',
            prenom: 'Martinien',
            email: email,
            role: 'admin',
            timestamp: new Date().toISOString()
          });
        } else if (email === 'ludo.consulting3@gmail.com') {
          await addDoc(collection(db, 'connections'), {
            user_id: userCredential.user.uid,
            nom: 'Consulting',
            prenom: 'Ludo',
            email: email,
            role: 'enseignant',
            timestamp: new Date().toISOString()
          });
        } else {
          // If user document doesn't exist and it's not the admin, delete the auth user and throw error
          await userCredential.user.delete();
          throw new Error("Profil utilisateur introuvable. Veuillez vous réinscrire.");
        }
      } catch (logErr) {
        if (logErr instanceof Error && logErr.message === "Profil utilisateur introuvable. Veuillez vous réinscrire.") {
          throw logErr;
        }
        console.error("Erreur lors de l'enregistrement de la connexion:", logErr);
      }
      // onAuthStateChanged will handle setting the user
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: Omit<User, 'id' | 'date_creation' | 'face_id' | 'fingerprint_id'>, mdp: string) => {
    if (!isFirebaseConfigured) throw new Error("Firebase non configuré");
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, userData.email, mdp);
      try {
        const newUser = Object.fromEntries(
          Object.entries({
            ...userData,
            user_id: userCredential.user.uid,
            date_creation: new Date().toISOString(),
            face_id: null,
            fingerprint_id: null
          }).filter(([_, v]) => v !== undefined)
        );
        await setDoc(doc(db, 'users', userCredential.user.uid), newUser, { merge: true });
      } catch (firestoreErr) {
        // If Firestore document creation fails, delete the user from Auth to allow retrying
        await userCredential.user.delete();
        throw firestoreErr;
      }
      // onAuthStateChanged will handle setting the user
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.id);
        await setDoc(docRef, {
          status: 'offline',
          lastSeen: serverTimestamp()
        }, { merge: true });
      }
      await signOut(auth);
      await stopSessionTracking();
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, register, logout, loading }}>
      {!isInitializing && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export function mapPositionToResponsibility(pos?: string): string[] {
  if (!pos) return [];
  const normalized = pos.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // strip accents
  
  if (normalized.includes('college')) return ['responsable_college'];
  if (normalized.includes('primaire')) return ['responsable_primaire'];
  if (normalized.includes('maternelle')) return ['responsable_maternelle'];
  if (normalized.includes('secretaire generale') || normalized === 'secretaire generale') return ['secretaire_generale'];
  if (normalized.includes('secretaire adjoint') || normalized === 'secretaire adjointe') return ['secretaire_adjointe'];
  if (normalized === 'surveillant' || normalized.includes('surveillant general') || normalized === 'surveillant general') return ['surveillant_general'];
  if (normalized.includes('surveillant adjoint')) return ['surveillant_adjoint'];
  if (normalized.includes('comptable')) return ['gestionnaire_comptable'];
  if (normalized.includes('pedagogique') || normalized.includes('charge pedagogique')) return ['responsable_pedagogique'];
  if (normalized.includes('menage')) return ['dame_menage'];
  return [];
}

export function getNormalizedRole(role: string): 'admin' | 'enseignant' | 'élève' | 'personnel administratif' | 'parent' | 'cuisinier' {
  if (!role) return 'élève';
  const r = role.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // strip accents
  if (r === 'super administrateur' || r === "administrateur d'etablissement" || r === "administrateur d’etablissement" || r === 'admin') {
    return 'admin';
  }
  if (r === 'enseignant') {
    return 'enseignant';
  }
  if (r === 'eleve') {
    return 'élève';
  }
  if (r === 'parent') {
    return 'parent';
  }
  if (r === 'comptable' || r === 'surveillant' || r === 'bibliothecaire' || r === 'personnel administratif') {
    return 'personnel administratif';
  }
  if (r === 'cuisinier') {
    return 'cuisinier';
  }
  return 'élève';
}
