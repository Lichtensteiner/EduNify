import React, { useState, useEffect, useRef } from 'react';
import { Fingerprint, ScanFace, CheckCircle2, AlertCircle, Camera, ChevronLeft, UserPlus, LogIn, ShieldCheck, RefreshCw, Camera as CameraIcon, Scan, Smartphone, Download } from 'lucide-react';
import { collection, addDoc, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { motion } from 'motion/react';

type Screen = 'auth_choice' | 'register_step1' | 'register_step2' | 'scan_choice' | 'scanner' | 'result';
type ScanMode = 'face' | 'fingerprint';

export default function MobileApp() {
  const { t } = useLanguage();
  const [currentScreen, setCurrentScreenState] = useState<Screen>('auth_choice');
  const [activeView, setActiveView] = useState<'simulator' | 'guide'>('simulator');

  useEffect(() => {
    // Initialize history state
    window.history.replaceState({ screen: 'auth_choice' }, '');

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.screen) {
        setCurrentScreenState(event.state.screen);
      } else {
        setCurrentScreenState('auth_choice');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setCurrentScreen = (screen: Screen, replace = false) => {
    setCurrentScreenState(screen);
    if (replace) {
      window.history.replaceState({ screen }, '');
    } else {
      window.history.pushState({ screen }, '');
    }
  };

  const [scanMode, setScanMode] = useState<ScanMode>('face');
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Biometric setup state
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [fingerprintRegistered, setFingerprintRegistered] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    matricule: '',
    role: 'élève',
    classe: ''
  });

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      setError("Impossible d'accéder à la caméra.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if ((currentScreen === 'scanner' || currentScreen === 'register_step2') && scanMode === 'face') {
      // Camera handled manually in the sim
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [currentScreen, scanMode]);

  const handleRegisterStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseConfigured) {
      setError("Firebase n'est pas configuré.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const newUser = {
        nom: formData.nom,
        prenom: formData.prenom,
        email: formData.email,
        matricule: formData.matricule,
        role: formData.role,
        ...(formData.role === 'élève' ? { classe: formData.classe } : {}),
        date_creation: new Date().toISOString(),
        face_id: null,
        fingerprint_id: null
      };

      const docRef = await addDoc(collection(db, 'users'), newUser);
      await updateDoc(docRef, { user_id: docRef.id });

      setCurrentUser({
        id: docRef.id,
        user_id: docRef.id,
        ...newUser
      });
      
      setFaceRegistered(false);
      setFingerprintRegistered(false);
      setRegistrationSuccess(false);
      setCurrentScreen('register_step2');
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors de la création du compte.");
    } finally {
      setLoading(false);
    }
  };

  const simulateBiometricRegistration = async (type: 'face' | 'fingerprint') => {
    setScanStatus('scanning');
    
    if (type === 'face' && videoRef.current && currentUser) {
      try {
        const canvas = document.createElement('canvas');
        const maxWidth = 400;
        const scale = Math.min(1, maxWidth / videoRef.current.videoWidth);
        canvas.width = videoRef.current.videoWidth * scale;
        canvas.height = videoRef.current.videoHeight * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.7));
          if (blob) {
            const storageRef = ref(storage, `users/${currentUser.id}/photo_biometric_${Date.now()}`);
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);
            const userRef = doc(db, 'users', currentUser.id);
            await updateDoc(userRef, { photo: downloadURL });
          }
        }
      } catch (err) {
        console.error("Erreur capture visage mobile:", err);
      }
    }

    setTimeout(() => {
      setScanStatus('success');
      if (type === 'face') setFaceRegistered(true);
      if (type === 'fingerprint') setFingerprintRegistered(true);
      setTimeout(() => setScanStatus('idle'), 1500);
    }, 1500);
  };

  const handleFinalizeRegistration = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        face_id: `face_${currentUser.id}`,
        fingerprint_id: `print_${currentUser.id}`
      });
      setRegistrationSuccess(true);
      setTimeout(() => {
        setCurrentScreen('auth_choice');
        setFormData({ nom: '', prenom: '', email: '', matricule: '', role: 'élève', classe: '' });
      }, 3000);
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'enregistrement biométrique.");
    } finally {
      setLoading(false);
    }
  };

  const handleScanPresence = async () => {
    setScanStatus('scanning');
    setTimeout(async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const validUsers = usersSnap.docs.filter(doc => {
          const data = doc.data();
          return data.face_id && data.fingerprint_id;
        });

        if (validUsers.length === 0) {
          setScanStatus('error');
          setError("Aucun utilisateur avec données biométriques trouvé.");
          setTimeout(() => setScanStatus('idle'), 3000);
          return;
        }

        const randomDoc = validUsers[Math.floor(Math.random() * validUsers.length)];
        const recognizedUser = { id: randomDoc.id, ...randomDoc.data() } as any;
        setCurrentUser(recognizedUser);

        const now = new Date();
        const timeString = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const isLate = now.getHours() >= 8;
        const status = isLate ? 'Retard' : 'Présent';
        const today = now.toISOString().split('T')[0];

        await addDoc(collection(db, 'attendance'), {
          user_id: recognizedUser.id,
          date: today,
          heure_arrivee: timeString,
          statut: status,
          timestamp: now.toISOString()
        });

        if (recognizedUser.role === 'élève') {
          await addDoc(collection(db, 'notifications'), {
            user_id: recognizedUser.id,
            type: 'attendance',
            message: `Votre enfant ${recognizedUser.prenom} ${recognizedUser.nom} est arrivé à l'école à ${timeString} (${status}).`,
            timestamp: now.toISOString(),
            status: 'sent'
          });
        }

        setScanStatus('success');
        setTimeout(() => {
          setScanStatus('idle');
          setCurrentScreen('result');
        }, 1500);

      } catch (err) {
        console.error(err);
        setScanStatus('error');
        setError("Erreur lors de la reconnaissance.");
        setTimeout(() => setScanStatus('idle'), 3000);
      }
    }, 2000);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'auth_choice':
        return (
          <div className="flex flex-col items-center justify-center h-full p-6 space-y-8 animate-in fade-in zoom-in duration-300 bg-white dark:bg-gray-900">
            <img src="/logo.png" alt="Logo" className="h-24 object-contain" />
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edu-Nify</h1>
              <p className="text-gray-500 dark:text-gray-400">Système de Présence Biométrique</p>
            </div>
            <div className="w-full space-y-4 mt-8">
              <button 
                onClick={() => setCurrentScreen('scan_choice')}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-3"
              >
                <ScanFace size={20} /> Scanner ma présence
              </button>
              <button 
                onClick={() => setCurrentScreen('register_step1')}
                className="w-full bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-100 dark:border-indigo-900/50 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3"
              >
                <UserPlus size={20} /> Créer un compte
              </button>
            </div>
          </div>
        );

      case 'register_step1':
        return (
          <div className="flex flex-col h-full p-6 animate-in slide-in-from-right duration-300 overflow-y-auto bg-white dark:bg-gray-900">
            <button onClick={() => setCurrentScreen('auth_choice')} className="mb-6 text-gray-500 flex items-center gap-2">
              <ChevronLeft size={20} /> Retour
            </button>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Inscription</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Saisissez vos informations de base.</p>
            
            <form onSubmit={handleRegisterStep1} className="space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
                <input type="text" required value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-xl" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prénom</label>
                <input type="text" required value={formData.prenom} onChange={e => setFormData({...formData, prenom: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-xl" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-xl" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rôle</label>
                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-xl">
                  <option value="élève">Élève</option>
                  <option value="enseignant">Enseignant</option>
                  <option value="personnel administratif">Administration</option>
                </select>
              </div>
              <button disabled={loading} type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg mt-4 flex justify-center items-center gap-2">
                {loading ? <RefreshCw className="animate-spin" size={20} /> : "Continuer"}
              </button>
            </form>
          </div>
        );

      case 'register_step2':
        return (
          <div className="flex flex-col h-full p-6 animate-in slide-in-from-right duration-300 bg-white dark:bg-gray-900">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Biométrie</h2>
            <p className="text-gray-500 mb-6 text-sm">Enregistrez vos données pour le pointage futur.</p>
            
            <div className="flex-1 space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border dark:border-gray-700 flex flex-col items-center">
                <div className="w-full h-40 bg-black rounded-xl overflow-hidden relative mb-4">
                  {scanMode === 'face' && !faceRegistered ? (
                    stream ? <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" /> : 
                    <button onClick={startCamera} className="absolute inset-0 flex items-center justify-center text-white"><CameraIcon size={32} /></button>
                  ) : faceRegistered ? <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center text-emerald-500"><CheckCircle2 size={48} /></div> : null}
                </div>
                <button 
                  onClick={() => { setScanMode('face'); simulateBiometricRegistration('face'); }}
                  className="w-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 py-3 rounded-xl font-bold"
                >
                  {faceRegistered ? "Visage enregistré" : "Scanner Visage"}
                </button>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border dark:border-gray-700 flex flex-col items-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${fingerprintRegistered ? 'bg-emerald-500/20 text-emerald-500' : 'bg-gray-200 text-gray-400'}`}>
                  <Fingerprint size={32} />
                </div>
                <button 
                  onClick={() => { setScanMode('fingerprint'); simulateBiometricRegistration('fingerprint'); }}
                  className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold"
                >
                  {fingerprintRegistered ? "Empreinte enregistrée" : "Scanner Empreinte"}
                </button>
              </div>
            </div>

            <button 
              onClick={handleFinalizeRegistration}
              disabled={!faceRegistered || !fingerprintRegistered || loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold mt-6"
            >
              {loading ? <RefreshCw className="animate-spin" size={20} /> : "Activer mon compte"}
            </button>
          </div>
        );

      case 'scan_choice':
        return (
          <div className="flex flex-col h-full p-6 animate-in fade-in duration-300 bg-white dark:bg-gray-900">
            <button onClick={() => setCurrentScreen('auth_choice')} className="mb-6 text-gray-500 flex items-center gap-2">
              <ChevronLeft size={20} /> Retour
            </button>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Pointer</h2>
            <div className="grid grid-cols-1 gap-4 mt-8">
              <button 
                onClick={() => { setScanMode('face'); setCurrentScreen('scanner'); }}
                className="bg-indigo-600 text-white p-8 rounded-3xl flex flex-col items-center gap-4"
              >
                <ScanFace size={48} />
                <span className="font-bold text-xl">Reconnaissance Faciale</span>
              </button>
              <button 
                onClick={() => { setScanMode('fingerprint'); setCurrentScreen('scanner'); }}
                className="bg-gray-900 text-white p-8 rounded-3xl flex flex-col items-center gap-4"
              >
                <Fingerprint size={48} />
                <span className="font-bold text-xl">Empreinte Digitale</span>
              </button>
            </div>
          </div>
        );

      case 'scanner':
        return (
          <div className="flex flex-col h-full bg-black text-white animate-in zoom-in-95 duration-300 relative">
            <button onClick={() => setCurrentScreen('scan_choice')} className="absolute top-6 left-6 z-20 bg-white/20 p-2 rounded-full backdrop-blur-md">
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="w-64 h-64 border-2 border-indigo-500/50 rounded-full flex items-center justify-center relative overflow-hidden">
                {scanMode === 'face' ? (
                   stream ? <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" /> : 
                   <button onClick={startCamera} className="p-4 bg-white/10 rounded-full"><CameraIcon size={32} /></button>
                ) : <Fingerprint size={80} className={scanStatus === 'scanning' ? 'animate-pulse text-indigo-400' : ''} />}
                {scanStatus === 'scanning' && <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 animate-bounce"></div>}
              </div>
              <p className="mt-8 text-gray-400 uppercase tracking-widest text-xs font-bold">{scanStatus === 'scanning' ? "Analyse en cours..." : "Ajustez votre position"}</p>
            </div>
            <div className="p-6">
              <button 
                onClick={handleScanPresence}
                disabled={scanStatus === 'scanning'}
                className="w-full bg-indigo-600 py-4 rounded-2xl font-bold text-lg"
              >
                Pointer maintenant
              </button>
            </div>
            {scanStatus === 'success' && <div className="absolute inset-0 bg-emerald-500/90 flex flex-col items-center justify-center"><CheckCircle2 size={80} className="mb-4" /><h2 className="text-3xl font-bold">Identifié !</h2></div>}
          </div>
        );

      case 'result':
        return (
          <div className="flex flex-col h-full p-6 bg-gray-50 dark:bg-gray-900 animate-in slide-in-from-bottom duration-500">
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-xl"><CheckCircle2 size={40} /></div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center tracking-tight">Pointage Réussi !</h2>
              <div className="w-full bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-xl border dark:border-gray-700 border-gray-100">
                <div className="flex flex-col items-center mb-6">
                  <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-2xl mb-4">{currentUser?.prenom?.[0]}{currentUser?.nom?.[0]}</div>
                  <h3 className="text-xl font-bold dark:text-white">{currentUser?.prenom} {currentUser?.nom}</h3>
                  <p className="text-indigo-600 text-sm font-bold uppercase">{currentUser?.role}</p>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b dark:border-gray-700 border-gray-50"><span className="text-gray-500">Heure</span><span className="font-bold dark:text-white">{new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</span></div>
                  <div className="flex justify-between py-2 border-b dark:border-gray-700 border-gray-50"><span className="text-gray-500">Statut</span><span className="text-emerald-600 font-bold">Présent</span></div>
                </div>
              </div>
              <button 
                onClick={() => setCurrentScreen('auth_choice')}
                className="w-full bg-gray-900 dark:bg-white dark:text-gray-900 text-white py-4 rounded-2xl font-bold text-lg mt-8 shadow-lg"
              >
                Terminer
              </button>
            </div>
          </div>
        );
    }
  };

  const renderInstallationGuide = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* iOS */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
             <div className="w-12 h-12 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center"><Smartphone className="text-gray-900 dark:text-white" /></div>
             <h3 className="font-bold text-gray-900 dark:text-white">Installation sur iPhone</h3>
          </div>
          <ol className="space-y-4 text-sm text-gray-600 dark:text-gray-300 list-decimal list-inside">
            <li>Ouvrez <strong>Safari</strong> et accédez à cette URL.</li>
            <li>Appuyez sur l'icône de <strong>Partage</strong> <Download className="inline" size={14} />.</li>
            <li>Sélectionnez <strong>"Sur l'écran d'accueil"</strong>.</li>
            <li>Appuyez sur <strong>Ajouter</strong>.</li>
          </ol>
        </motion.div>
        {/* Android */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
             <div className="w-12 h-12 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center"><Download className="text-gray-900 dark:text-white" /></div>
             <h3 className="font-bold text-gray-900 dark:text-white">Installation sur Android</h3>
          </div>
          <ol className="space-y-4 text-sm text-gray-600 dark:text-gray-300 list-decimal list-inside">
            <li>Ouvrez <strong>Chrome</strong> et accédez à cette URL.</li>
            <li>Appuyez sur les <strong>trois points</strong> en haut à droite.</li>
            <li>Sélectionnez <strong>"Installer l'application"</strong>.</li>
            <li>Confirmez l'installation.</li>
          </ol>
        </motion.div>
      </div>

      <div className="bg-indigo-600 p-8 rounded-3xl text-white">
        <h3 className="text-xl font-bold mb-2 tracking-tight">Accessibilité Temps Réel</h3>
        <p className="text-indigo-100 text-sm">L'application détecte automatiquement votre appareil et ajuste l'affichage pour garantir une expérience sans débordement de texte.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('mobile_app')}</h1>
          <p className="text-sm text-gray-500">Installation et simulation mobile</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl w-full md:w-auto">
          <button 
            onClick={() => setActiveView('simulator')}
            className={`flex-1 md:px-8 py-2 rounded-xl text-sm font-bold transition-all ${activeView === 'simulator' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500'}`}
          >
            Simulateur
          </button>
          <button 
            onClick={() => setActiveView('guide')}
            className={`flex-1 md:px-8 py-2 rounded-xl text-sm font-bold transition-all ${activeView === 'guide' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500'}`}
          >
            Guide
          </button>
        </div>
      </div>

      {activeView === 'simulator' ? (
        <div className="flex items-center justify-center min-h-[600px] p-4 sm:p-8 bg-gray-50/50 dark:bg-gray-900/50 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-700">
           <div className="w-[380px] h-[780px] bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl border-[10px] border-gray-900 overflow-hidden relative scale-90 sm:scale-100">
              <div className="absolute top-0 left-1/2 -track-x-1/2 w-32 h-6 bg-gray-900 rounded-b-2xl z-50"></div>
              <div className="h-full overflow-y-auto custom-scrollbar">
                {renderScreen()}
              </div>
           </div>
        </div>
      ) : renderInstallationGuide()}
    </div>
  );
}
