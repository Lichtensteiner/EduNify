import React, { useState, useEffect } from 'react';
import { useAuth, User } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  RefreshCw, 
  ShieldCheck, 
  UserPlus, 
  GraduationCap, 
  Users, 
  BookOpen, 
  Briefcase, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  MapPin,
  Lock,
  Phone,
  Mail,
  UserCheck,
  ShieldAlert,
  Hash
} from 'lucide-react';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

export default function Login() {
  const [isRegisteringState, setIsRegisteringState] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login, register, loading } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    // Initialize history state
    window.history.replaceState({ isRegistering: false }, '');

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.isRegistering !== undefined) {
        setIsRegisteringState(event.state.isRegistering);
      } else {
        setIsRegisteringState(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const isRegistering = isRegisteringState;
  const setIsRegistering = (value: boolean) => {
    setIsRegisteringState(value);
    if (value) {
      window.history.pushState({ isRegistering: true }, '');
    } else {
      window.history.pushState({ isRegistering: false }, '');
    }
    // Reset steps and states when toggling
    setStep(1);
    setSelectedProfile('');
    setError('');
    setSuccess('');
  };

  // Stepper State
  const [step, setStep] = useState(1);
  const [selectedProfile, setSelectedProfile] = useState<'élève' | 'parent' | 'enseignant' | 'personnel administratif' | 'admin' | ''>('');

  // Login credentials state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Universal registration states
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [lieuNaissance, setLieuNaissance] = useState('');
  
  // Profile specific registration states
  const [matricule, setMatricule] = useState('');
  const [classe, setClasse] = useState('');
  const [houseId, setHouseId] = useState('');
  const [telephone, setTelephone] = useState('');
  const [position, setPosition] = useState('');

  // Administrative secure registration squeeze states
  const [enrollmentToken, setEnrollmentToken] = useState('');
  const [showTokenHelp, setShowTokenHelp] = useState(false);

  // Firestore DB options
  const [houses, setHouses] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  // Parse direct parrainage code from URL query parameters (?code=XYZ or ?token=XYZ)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token') || params.get('code') || params.get('invite');
    if (tokenFromUrl) {
      setEnrollmentToken(tokenFromUrl);
      const cleanToken = tokenFromUrl.trim().toUpperCase();
      if (cleanToken.includes('PROF') || cleanToken.includes('TEACHER')) {
        setSelectedProfile('enseignant');
        setIsRegisteringState(true);
        setStep(2);
      } else if (cleanToken.includes('ADMIN')) {
        setSelectedProfile('admin');
        setIsRegisteringState(true);
        setStep(2);
      } else if (cleanToken.includes('STAFF') || cleanToken.includes('PERS')) {
        setSelectedProfile('personnel administratif');
        setIsRegisteringState(true);
        setStep(2);
      }
    }
  }, []);

  // Fetch houses & classes
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'houses'), (snapshot) => {
      const housesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHouses(housesData);
    }, (err) => {
      console.error("Erreur onSnapshot houses:", err);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'classes'), (snapshot) => {
      const classesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClasses(classesData);
    }, (err) => {
      console.error("Erreur onSnapshot classes:", err);
    });
    return () => unsubscribe();
  }, []);

  // Back button functionality
  const handleBackToStep1 = () => {
    setStep(1);
    setError('');
  };

  const handleNextToStep2 = () => {
    setError('');
    
    if (!selectedProfile) {
      setError("Veuillez sélectionner votre profil utilisateur pour continuer.");
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (isRegistering) {
        // Enforce validations in active mode
        if (step === 1) {
          handleNextToStep2();
          return;
        }

        // Basic fields checking
        if (!nom || !prenom || !email || !password || !confirmPassword || !dateNaissance || !lieuNaissance) {
          setError("Veuillez renseigner tous les champs requis obligatoires.");
          return;
        }

        // Passwords match
        if (password !== confirmPassword) {
          setError("La confirmation du mot de passe ne correspond pas au mot de passe saisi.");
          return;
        }

        if (password.length < 6) {
          setError("Le mot de passe doit posséder au moins 6 caractères pour des raisons de sécurité.");
          return;
        }

        // Lieu naissance formatting
        if (lieuNaissance.trim().length === 0) {
          setError("Veuillez renseigner un lieu de naissance valide.");
          return;
        }

        // Age validations client side
        const birthDateObj = new Date(dateNaissance);
        const todayObj = new Date();
        const age = todayObj.getFullYear() - birthDateObj.getFullYear();

        if (selectedProfile === 'élève') {
          if (age < 3 || age > 25) {
            setError("L'âge de l'élève à l'inscription doit obligatoirement être compris entre 3 ans et 25 ans.");
            return;
          }
          if (!matricule) {
            setError("Le matricule est obligatoire pour compléter l'inscription de l'élève.");
            return;
          }
          if (!classe) {
            setError("Veuillez sélectionner la classe d'affectation de l'élève.");
            return;
          }
        } else if (selectedProfile === 'parent') {
          if (age < 18) {
            setError("Le profil Parent d'élève nécessite d'avoir au moins 18 ans.");
            return;
          }
          if (!telephone) {
            setError("Le numéro de téléphone du tuteur est requis pour les notifications urgentes et assiduités.");
            return;
          }
        } else if (selectedProfile === 'enseignant') {
          if (age < 18) {
            setError("Le profil Enseignant nécessite d'avoir au moins 18 ans.");
            return;
          }
          if (!matricule) {
            setError("Le matricule enseignant est requis afin de valider vos cours.");
            return;
          }
        } else if (selectedProfile === 'personnel administratif') {
          if (age < 18) {
            setError("Le personnel administratif doit être âgé de minimum 18 ans.");
            return;
          }
          if (!matricule) {
            setError("Le matricule personnel administratif est requis.");
            return;
          }
          if (!position) {
            setError("Veuillez sélectionner votre responsabilité ou fonction administrative.");
            return;
          }
        }

        // Special Admin validation
        if (selectedProfile === 'admin' && email.toLowerCase() !== 'martinienmvezogo@gmail.com') {
          setError("Seule l'adresse administrative enregistrée (martinienmvezogo@gmail.com) peut s'authentifier en tant qu'administrateur principal.");
          return;
        }

        // Secure Squeeze token restriction for employees & administrators
        const isEmployeeOrAdmin = ['admin', 'enseignant', 'personnel administratif'].includes(selectedProfile);
        if (isEmployeeOrAdmin) {
          if (!enrollmentToken) {
            setError(`🔒 Jeton d'enrôlement requis : La création de comptes de type "${selectedProfile}" exige la saisie d'un jeton d'autorisation valide.`);
            return;
          }
          const cleanToken = enrollmentToken.trim().toUpperCase();
          const validAdminTokens = ['ADMIN-SUPER-SECURE-2026', 'MARTINIEN-ADMIN-2026', 'ADMIN-LUDO-2026'];
          const validTeacherTokens = ['PROF-SECURE-2026', 'ENSEIGNANT-LUDO-2026', 'PROF-GABON-2026'];
          const validStaffTokens = ['STAFF-SECURE-2026', 'PERS-LUDO-2026', 'GABON-STAFF-2026'];

          let isValid = false;
          if (selectedProfile === 'admin' && validAdminTokens.includes(cleanToken)) {
            isValid = true;
          } else if (selectedProfile === 'enseignant' && validTeacherTokens.includes(cleanToken)) {
            isValid = true;
          } else if (selectedProfile === 'personnel administratif' && validStaffTokens.includes(cleanToken)) {
            isValid = true;
          }

          if (!isValid) {
            setError(`⚠️ Alerte Sécurité : Le jeton d'affiliation "${enrollmentToken}" saisi est invalide pour le rôle de "${selectedProfile}". Accès refusé.`);
            return;
          }
        }

        // DATABASE UNIQUE CHECKS (Email & Matricule check in Firestore)
        const emailCheckQuery = query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()));
        const emailSnap = await getDocs(emailCheckQuery);
        if (!emailSnap.empty) {
          setError("⚠️ Cette adresse e-mail est déjà utilisée par un autre utilisateur.");
          return;
        }

        if (matricule) {
          const matriculeCheckQuery = query(collection(db, 'users'), where('matricule', '==', matricule.trim()));
          const matriculeSnap = await getDocs(matriculeCheckQuery);
          if (!matriculeSnap.empty) {
            setError("⚠️ Ce matricule est déjà attribué à un autre compte membre. Veuillez vérifier votre matricule officiel.");
            return;
          }
        }

        // backend endpoints validation proxy to ensure Server API validations
        let backendEndpoint = '';
        if (selectedProfile === 'élève') {
          backendEndpoint = '/api/auth/register/student';
        } else if (selectedProfile === 'parent') {
          backendEndpoint = '/api/auth/register/parent';
        } else if (selectedProfile === 'enseignant') {
          backendEndpoint = '/api/auth/register/teacher';
        } else if (selectedProfile === 'personnel administratif') {
          backendEndpoint = '/api/auth/register/staff';
        }

        if (backendEndpoint) {
          const payload = {
            nom,
            prenom,
            email,
            password,
            confirmPassword,
            dateNaissance,
            lieuNaissance,
            matricule,
            classe,
            house_id: houseId,
            telephone,
            position
          };

          const apiResponse = await fetch(backendEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!apiResponse.ok) {
            const errData = await apiResponse.json();
            setError(`[Serveur] ${errData.error || "La validation côté serveur a échoué."}`);
            return;
          }
        }

        // API checks succeeded -> proceed with safe authentic client register hooks!
        await register({
          nom: nom.trim(),
          prenom: prenom.trim(),
          email: email.toLowerCase().trim(),
          role: selectedProfile as User['role'],
          matricule: matricule.trim() || undefined,
          age,
          gender: 'not_specified',
          ...(selectedProfile === 'élève' ? { classe, house_id: houseId || undefined } : {}),
          ...(selectedProfile === 'parent' ? { contact: telephone } : {}),
          ...(selectedProfile === 'personnel administratif' ? { position, department: 'Administration' } : {})
        }, password);

        setSuccess("🎉 Votre inscription en tant que " + selectedProfile + " a été validée et enregistrée avec succès ! Redirection en cours...");
      } else {
        // Log in flow
        if (!loginEmail || !loginPassword) {
          setError(t('enter_email_password'));
          return;
        }
        await login(loginEmail, loginPassword);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError(t('email_already_used'));
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError(t('incorrect_email_password'));
      } else if (err.code === 'auth/weak-password') {
        setError(t('password_min_length'));
      } else if (err.code === 'auth/configuration-not-found') {
        setError(t('auth_not_enabled'));
      } else if (err.code === 'auth/network-request-failed') {
        setError(t('network_error'));
      } else {
        setError(err.message || t('error_occurred'));
      }
    }
  };

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const cardVariants: any = {
    hidden: { opacity: 0, y: 30, scale: 0.98 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } 
    }
  };

  const fadeUpVariants: any = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.4, ease: "easeOut" } 
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="sm:mx-auto sm:w-full sm:max-w-2xl text-center space-y-4"
      >
        <div className="inline-flex p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-3xl border border-indigo-100 dark:border-indigo-900/60 shadow-inner hover:scale-105 transition-transform duration-300">
          <img src="/logo.png" alt="Edu-Nify Logo" className="h-16 w-16 object-contain" />
        </div>
        <div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 uppercase font-black tracking-widest text-[11px]">
            {t('attendance_management_system')}
          </p>
        </div>
      </motion.div>

      <motion.div 
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl"
      >
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-xl rounded-3xl border border-gray-100 dark:border-slate-800 transition-all">
          
          {/* Form Header with Stepper Progress Bar */}
          {isRegistering ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-8 space-y-4"
            >
              <div className="flex justify-between items-center text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                <span className="bg-indigo-50 dark:bg-indigo-950/70 px-3 py-1 rounded-full text-xs">
                  {step === 1 ? "Étape 1 : Choix du Profil" : "Étape 2 : Formulaire d'information"}
                </span>
                <span className="font-mono text-xs">{step === 1 ? "50%" : "100%"}</span>
              </div>
              
              <div className="w-full bg-gray-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <motion.div 
                  className="bg-indigo-600 h-full rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: step === 1 ? '50%' : '100%' }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>

              <div className="text-center">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  {step === 1 
                    ? "Sélectionnez votre type de profil" 
                    : `Formulaire d'inscription : ${selectedProfile.toUpperCase()}`
                  }
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-normal">
                  {step === 1 
                    ? "Aucun rôle n'est sélectionnable via menu classique. Choisissez la carte correspondant à votre fonction." 
                    : "Renseignez vos coordonnées authentiques. Les matricules et identités seront contrôlés."
                  }
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-8 text-center space-y-1"
            >
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Connexion Espace Membre</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Saisissez vos identifiants pour entrer sur la plateforme Edu-Nify</p>
            </motion.div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 p-4 rounded-2xl text-xs border border-rose-100 dark:border-rose-900/40 flex items-start gap-2 animate-shake"
            >
              <ShieldAlert className="shrink-0 mt-0.5 text-rose-500" size={16} />
              <div className="font-semibold leading-relaxed">{error}</div>
            </motion.div>
          )}

          {success && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl text-xs border border-emerald-100 dark:border-emerald-950 flex items-start gap-2"
            >
              <UserCheck className="shrink-0 mt-0.5 text-emerald-500" size={16} />
              <div className="font-semibold leading-relaxed">{success}</div>
            </motion.div>
          )}

          {isRegistering ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* STEP 1: CARD SELECTION */}
              {step === 1 && (
                <motion.div 
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* card student */}
                    <motion.div 
                      variants={fadeUpVariants}
                      whileHover={{ scale: 1.015, translateY: -2 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => setSelectedProfile('élève')}
                      className={`relative cursor-pointer p-5 rounded-2xl border-2 transition-colors flex flex-col justify-between h-36 duration-200 ${
                        selectedProfile === 'élève' 
                          ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-md' 
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`p-2.5 rounded-xl ${selectedProfile === 'élève' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                          <GraduationCap size={22} />
                        </div>
                        {selectedProfile === 'élève' && (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">✓</div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-md">Élève / Étudiant</h4>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal mt-0.5 truncate">Fiche d'apprentissage académique, classe & maison</p>
                      </div>
                    </motion.div>

                    {/* card parent */}
                    <motion.div 
                      variants={fadeUpVariants}
                      whileHover={{ scale: 1.015, translateY: -2 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => setSelectedProfile('parent')}
                      className={`relative cursor-pointer p-5 rounded-2xl border-2 transition-colors flex flex-col justify-between h-36 duration-200 ${
                        selectedProfile === 'parent' 
                          ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-md' 
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`p-2.5 rounded-xl ${selectedProfile === 'parent' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                          <Users size={22} />
                        </div>
                        {selectedProfile === 'parent' && (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">✓</div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-md">Parent / Tuteur</h4>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal mt-0.5 truncate">Suivi assiduité, notes scolaires et frais de cantine</p>
                      </div>
                    </motion.div>

                    {/* card teacher */}
                    <motion.div 
                      variants={fadeUpVariants}
                      whileHover={{ scale: 1.015, translateY: -2 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => setSelectedProfile('enseignant')}
                      className={`relative cursor-pointer p-5 rounded-2xl border-2 transition-colors flex flex-col justify-between h-36 duration-200 ${
                        selectedProfile === 'enseignant' 
                          ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-md' 
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`p-2.5 rounded-xl ${selectedProfile === 'enseignant' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                          <BookOpen size={22} />
                        </div>
                        {selectedProfile === 'enseignant' && (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">✓</div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-md">Enseignant / Professeur</h4>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal mt-0.5 truncate">Appel journalier, bulletin & évaluations pédagogiques</p>
                      </div>
                    </motion.div>

                    {/* card staff */}
                    <motion.div 
                      variants={fadeUpVariants}
                      whileHover={{ scale: 1.015, translateY: -2 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => setSelectedProfile('personnel administratif')}
                      className={`relative cursor-pointer p-5 rounded-2xl border-2 transition-colors flex flex-col justify-between h-36 duration-200 ${
                        selectedProfile === 'personnel administratif' 
                          ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-md' 
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`p-2.5 rounded-xl ${selectedProfile === 'personnel administratif' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                          <Briefcase size={22} />
                        </div>
                        {selectedProfile === 'personnel administratif' && (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">✓</div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-md">Personnel Administratif</h4>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal mt-0.5 truncate">Responsables, secrétaires, comptabilité de l'école</p>
                      </div>
                    </motion.div>

                  </div>

                  {/* Optional Administrative Back Door Code Toggle for Martinien Admin */}
                  <motion.div 
                    variants={fadeUpVariants}
                    className="pt-4 border-t border-gray-100 dark:border-gray-800 text-center"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProfile('admin');
                        setStep(2);
                      }}
                      className="text-xs text-indigo-500 hover:text-indigo-600 hover:underline font-bold transition-all"
                    >
                      🔒 Vous êtes administrateur principal ? S'inscrire ici
                    </button>
                  </motion.div>

                  <motion.div 
                    variants={fadeUpVariants}
                    className="flex justify-end pt-4"
                  >
                    <button
                      type="button"
                      onClick={handleNextToStep2}
                      disabled={!selectedProfile}
                      className="inline-flex items-center gap-2 py-3 px-6 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-600/10"
                    >
                      Continuer vers le formulaire
                      <ChevronRight size={18} />
                    </button>
                  </motion.div>
                </motion.div>
              )}

              {/* STEP 2: DYNAMIC FORM TAILORED FIELDS */}
              {step === 2 && (
                <div className="space-y-6">
                  
                  {/* Status header indicating current profile path strictly */}
                  <div className="bg-slate-100 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800 text-xs flex justify-between items-center text-slate-700 dark:text-slate-350">
                    <span className="font-bold flex items-center gap-1.5 capitalize">
                      ⭐ Profil : <span className="text-indigo-650 font-black">{selectedProfile}</span>
                    </span>
                    <button 
                      type="button" 
                      onClick={handleBackToStep1} 
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-extrabold"
                    >
                      Modifier le profil
                    </button>
                  </div>

                  {/* Core Base Fields Group 1: Identity */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Nom</label>
                      <input
                        type="text"
                        required
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        placeholder="Ex: Mvezogo"
                        className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 dark:bg-gray-800 dark:text-slate-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Prénom</label>
                      <input
                        type="text"
                        required
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        placeholder="Ex: Martinien"
                        className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 dark:bg-gray-800 dark:text-slate-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
                      />
                    </div>
                  </div>

                  {/* Core Base Fields Group 2: Birth */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5"><Calendar size={14}/> Date de naissance</label>
                      <input
                        type="date"
                        required
                        value={dateNaissance}
                        onChange={(e) => setDateNaissance(e.target.value)}
                        className="mt-1 block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5"><MapPin size={14}/> Lieu de naissance</label>
                      <input
                        type="text"
                        required
                        value={lieuNaissance}
                        onChange={(e) => setLieuNaissance(e.target.value)}
                        placeholder="Ex: Libreville, Gabon"
                        className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 dark:bg-gray-800 dark:text-slate-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
                      />
                    </div>
                  </div>

                  {/* Profile-Tailored Dynamic Fields */}

                  {/* 1. STUDENT SPECIFIC */}
                  {selectedProfile === 'élève' && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-gray-150 dark:border-slate-800 space-y-4">
                      <p className="text-xs font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <GraduationCap size={16} /> Renseignements Scolaires de l'Élève
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1"><Hash size={13}/> Matricule de l'Élève <span className="text-rose-500">*</span></label>
                          <input
                            type="text"
                            required
                            value={matricule}
                            onChange={(e) => setMatricule(e.target.value)}
                            placeholder="Ex: ELEVE-2026-A10"
                            className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono tracking-wide uppercase"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wider">Classe d'étude <span className="text-rose-500">*</span></label>
                          <select
                            required
                            value={classe}
                            onChange={(e) => setClasse(e.target.value)}
                            className="mt-1 block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="">-- Choisir une classe --</option>
                            {classes.map(cls => (
                              <option key={cls.id} value={cls.nom}>{cls.nom}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wider">Maison d'affectation (Optionnel)</label>
                        <select
                          value={houseId}
                          onChange={(e) => setHouseId(e.target.value)}
                          className="mt-1 block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">-- Sans Maison d'école --</option>
                          {houses.map(house => (
                            <option key={house.id} value={house.id}>{house.nom_maison}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* 2. PARENT SPECIFIC */}
                  {selectedProfile === 'parent' && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-gray-150 dark:border-slate-800 space-y-4">
                      <p className="text-xs font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <Users size={16} /> Informations de contact du Parent d'Élève
                      </p>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><Phone size={14}/> Téléphone mobile du Tuteur <span className="text-rose-500">*</span></label>
                        <input
                          type="tel"
                          required
                          value={telephone}
                          onChange={(e) => setTelephone(e.target.value)}
                          placeholder="Ex: +241 062-641-120"
                          className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
                        />
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Sert de passerelle d'alertes par SMS ou WhatsApp scolaires.</p>
                      </div>
                    </div>
                  )}

                  {/* 3. TEACHER SPECIFIC */}
                  {selectedProfile === 'enseignant' && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-gray-150 dark:border-slate-800 space-y-4">
                      <p className="text-xs font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <BookOpen size={16} /> Certifications & Identité Pédagogique
                      </p>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1"><Hash size={13}/> Matricule Officiel Enseignant <span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          required
                          value={matricule}
                          onChange={(e) => setMatricule(e.target.value)}
                          placeholder="Ex: PROF-2026-X77"
                          className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono tracking-wide uppercase"
                        />
                      </div>
                    </div>
                  )}

                  {/* 4. ADMINISTRATIVE STAFF SPECIFIC */}
                  {selectedProfile === 'personnel administratif' && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-gray-150 dark:border-slate-800 space-y-4">
                      <p className="text-xs font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <Briefcase size={16} /> Renseignements de la Fonction Administrative
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1"><Hash size={13}/> Matricule Personnel <span className="text-rose-500">*</span></label>
                          <input
                            type="text"
                            required
                            value={matricule}
                            onChange={(e) => setMatricule(e.target.value)}
                            placeholder="Ex: STAFF-2026-N2"
                            className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono tracking-wide uppercase"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wider">Poste / Responsabilité désignée <span className="text-rose-500">*</span></label>
                          <select
                            required
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            className="mt-1 block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="">-- Choisir poste --</option>
                            <option value="responsable collège">Responsable collège</option>
                            <option value="responsable primaire">Responsable primaire</option>
                            <option value="responsable maternelle">Responsable maternelle</option>
                            <option value="secrétaire générale">Secrétaire générale</option>
                            <option value="secrétaire adjoint">Secrétaire adjoint</option>
                            <option value="surveillant">Surveillant</option>
                            <option value="comptable">Comptable</option>
                            <option value="chargé pédagogique">Chargé pédagogique</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5. ADMIN SPECIFIC BACKDOOR */}
                  {selectedProfile === 'admin' && (
                    <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-2xl border border-orange-250 dark:border-orange-900/60 space-y-4 text-orange-900 dark:text-orange-350">
                      <p className="text-xs font-extrabold flex items-center gap-1.5 uppercase">
                        <Lock size={15} /> Administration Principal / Gardien du temple
                      </p>
                      <p className="text-[10px] leading-relaxed">
                        ⚠️ Avis de restriction : L'inscription Administrateur est contrôlée via la boîte exclusive <code className="font-bold text-xs bg-orange-100 dark:bg-orange-900/40 px-1 rounded">martinienmvezogo@gmail.com</code> et requiert une clé d'enrôlement valide approuvée par le serveur.
                      </p>
                    </div>
                  )}

                  {/* Token Integration Secure Checks for Teachers, Staffs, Administrators */}
                  {['admin', 'enseignant', 'personnel administratif'].includes(selectedProfile) && (
                    <div className="bg-indigo-50/50 dark:bg-slate-900 status-token p-4 rounded-2xl border border-indigo-100 dark:border-slate-800 space-y-2 mt-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-indigo-900 dark:text-indigo-400 tracking-wider flex items-center gap-1.5 uppercase">
                          <ShieldCheck className="text-indigo-650 shrink-0" size={16} />
                          Jeton de sécurité d'Enrôlement requis <span className="text-rose-500 font-black animate-pulse">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowTokenHelp(!showTokenHelp)}
                          className="text-[10px] text-indigo-650 dark:text-indigo-400 hover:underline font-bold focus:outline-none"
                        >
                          {showTokenHelp ? "Masquer l'aide" : "Où trouver le jeton ?"}
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        value={enrollmentToken}
                        onChange={(e) => setEnrollmentToken(e.target.value)}
                        placeholder="Saisir la clé d'affiliation de votre rôle officiel"
                        className="appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono bg-white dark:bg-gray-800 dark:text-gray-100"
                      />
                      {showTokenHelp && (
                        <div className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed bg-white/80 dark:bg-gray-800 p-3 rounded-xl border border-indigo-100 dark:border-gray-700 space-y-2">
                          <p className="font-extrabold text-indigo-950 dark:text-white">🛡️ Passerelles de sécurité (Squeezes) :</p>
                          <p>Pour des raisons de haute confidentialité de l'école Edu-Nify, l'enrôlement d'agents nécessite un code vérifié.</p>
                          
                          <div className="pt-1.5 border-t border-gray-100 dark:border-gray-700/60 space-y-1">
                            <span className="font-bold text-gray-700 dark:text-gray-300">🔑 Clés d'intégrations admises :</span>
                            <div className="grid grid-cols-1 gap-1 text-[10px] bg-slate-100 dark:bg-gray-900 p-2 rounded-lg font-mono text-slate-705 dark:text-gray-350">
                              <p>• Administrateur: <span className="font-extrabold text-emerald-600">ADMIN-LUDO-2026</span></p>
                              <p>• Enseignant: <span className="font-extrabold text-blue-600">PROF-SECURE-2026</span></p>
                              <p>• Personnel Admin: <span className="font-extrabold text-indigo-600">STAFF-SECURE-2026</span></p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Core Base Fields Group 3: Email & Password */}
                  <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5"><Mail size={14}/> Adresse E-mail <span className="text-rose-500">*</span></label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nom@edu-nify.com"
                        className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 dark:bg-gray-800 dark:text-slate-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5"><Lock size={14}/> Mot de passe <span className="text-rose-500">*</span></label>
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 dark:bg-gray-800 dark:text-slate-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5"><Lock size={14}/> Confirmation mot de passe <span className="text-rose-500">*</span></label>
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 dark:bg-gray-800 dark:text-slate-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Navigation Buttons for Step Form Step 2 */}
                  <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={handleBackToStep1}
                      className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 transition-colors font-bold uppercase tracking-wider focus:outline-none"
                    >
                      <ChevronLeft size={16} /> Revenir à l'étape 1
                    </button>

                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center gap-2 py-3 px-6 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 shadow-md transition-all font-bold"
                    >
                      {loading ? (
                        <RefreshCw className="animate-spin" size={18} />
                      ) : (
                        <UserPlus size={18} />
                      )}
                      {loading ? "Vérification..." : "Valider l'inscription"}
                    </button>
                  </div>

                </div>
              )}

            </form>
          ) : (
            
            /* Standard Login Form */
            <motion.form 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6" 
              onSubmit={handleSubmit}
            >
              
              <motion.div variants={fadeUpVariants}>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail size={14} className="text-gray-400" />
                  {t('email')}
                </label>
                <div className="mt-1">
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 dark:bg-gray-800 dark:text-slate-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium"
                    placeholder="nom@edu-nify.com"
                  />
                </div>
              </motion.div>

              <motion.div variants={fadeUpVariants}>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock size={14} className="text-gray-400" />
                  {t('password')}
                </label>
                <div className="mt-1">
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 dark:bg-gray-800 dark:text-slate-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium"
                    placeholder="••••••••"
                  />
                </div>
              </motion.div>

              <motion.div variants={fadeUpVariants}>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-colors shadow-lg shadow-indigo-600/10 animate-pulse-subtle"
                >
                  {loading ? (
                    <RefreshCw className="animate-spin" size={20} />
                  ) : (
                    <ShieldCheck size={20} />
                  )}
                  {loading ? t('verifying') : t('login_button')}
                </button>
              </motion.div>
            </motion.form>
          )}
          
          {/* Footer toggle Login vs SignUp */}
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
                setSuccess('');
              }}
              className="text-sm font-bold text-indigo-600 dark:text-indigo-450 hover:text-indigo-500 transition-colors flex items-center justify-center gap-1.5 mx-auto"
            >
              {isRegistering ? (
                <>
                  <ChevronLeft size={16} />
                  Déjà un compte ? Connectez-vous ici
                </>
              ) : (
                <>
                  Nouveau sur Edu-Nify ? Créer un compte en 2 étapes
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
