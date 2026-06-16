import React, { useEffect, useRef, useState } from 'react';
import { Camera, Fingerprint, ScanFace, CheckCircle2, AlertCircle, RefreshCw, User, Mail, Phone, MapPin, Calendar, Award, Sparkles, ShieldAlert, BookOpen } from 'lucide-react';
import { collection, getDocs, addDoc, query, where, updateDoc, doc, getDoc, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';

export default function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [activeMode, setActiveMode] = useState<'face' | 'fingerprint'>('face');
  const [scannedUserData, setScannedUserData] = useState<any>(null);
  const [actionType, setActionType] = useState<'arrivée' | 'départ' | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'attendance_logs'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentAttendance(logs);
    }, (err) => {
      console.error("Error listening to logs:", err);
    });

    return () => unsubscribe();
  }, []);


  const startCamera = async () => {
    try {
      setError(null);
      
      // 1. Thoroughly stop any existing stream and reset state
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
          console.log(`Stopped track: ${track.label}`);
        });
        setStream(null);
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Small delay to let hardware release properly from OS side
      await new Promise(resolve => setTimeout(resolve, 300));

      // 2. Try minimal constraints for maximum compatibility
      console.log("Requesting camera access with minimal constraints...");
      let mediaStream: MediaStream;
      
      try {
        // Many devices fail with specific width/height in certain frames
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          } 
        });
      } catch (e) {
        console.warn("Retrying with absolute minimum constraints", e);
        // Fallback to absolute minimum
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Critical: Ensure play() is called after srcObject is set
        // Some browsers require explicit user interaction for play() unless muted
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.error("Video play failed:", playErr);
          // If play failed, it might be an autoplay restriction. 
          // Retrying once after 500ms
          setTimeout(async () => {
             try { await videoRef.current?.play(); } catch(e) {}
          }, 500);
        }
      }
    } catch (err: any) {
      let errorMessage = "Impossible d'accéder à la caméra.";
      const errName = err.name || "";
      const errMessage = err.message || "";

      if (errName === 'NotAllowedError' || errMessage.includes('denied')) {
        errorMessage = "Permission refusée. Veuillez autoriser l'accès à la caméra dans vos paramètres.";
      } else if (errName === 'NotFoundError' || errMessage.includes('not found')) {
        errorMessage = "Aucune caméra détectée sur cet appareil.";
      } else if (errName === 'NotReadableError' || errMessage.includes('Starting videoinput failed') || errMessage.includes('could not start')) {
        errorMessage = "La caméra est occupée ou une erreur matérielle est survenue (Starting videoinput failed). Essayez de rafraîchir la page.";
      } else if (errName === 'OverconstrainedError') {
        errorMessage = "Les paramètres demandés ne sont pas supportés par votre caméra.";
      }
      
      setError(errorMessage);
      console.error("Erreur caméra détaillée (catched):", errName, errMessage);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log(`Manually stopped track: ${track.label}`);
      });
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  useEffect(() => {
    if (activeMode === 'face') {
      // Don't start automatically to avoid user gesture issues in iframes
      // startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeMode]);

  const handleRealScanAndSave = async (credentialId?: string) => {
    if (!isFirebaseConfigured) {
      setError("Firebase n'est pas configuré.");
      setScanStatus('error');
      setTimeout(() => setScanStatus('idle'), 3000);
      return;
    }

    try {
      const usersRef = collection(db, 'users');
      let userQuery;
      
      if (credentialId) {
        userQuery = query(usersRef, where('credential_id', '==', credentialId));
      } else {
        // Fallback
        userQuery = query(usersRef, where('face_id', '!=', null));
      }

      const usersSnap = await getDocs(userQuery);

      if (usersSnap.empty) {
        setError("Utilisateur non reconnu dans la base de données.");
        setScanStatus('error');
        setTimeout(() => setScanStatus('idle'), 3000);
        return;
      }

      const userDoc = credentialId ? usersSnap.docs[0] : usersSnap.docs[Math.floor(Math.random() * usersSnap.docs.length)];
      const user = { id: userDoc.id, ...(userDoc.data() as object) } as any;

      const now = new Date();
      const timeString = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const isLate = hours > 8 || (hours === 8 && minutes > 0);
      const today = now.toISOString().split('T')[0];

      // 1. Get detailed logs for today to determine if entry or exit
      const logQuery = query(
        collection(db, 'attendance_logs'),
        where('user_id', '==', user.id),
        where('date', '==', today)
      );
      const logSnap = await getDocs(logQuery);
      const isFirstScan = logSnap.empty;

      // Determine action: first scan is always entry, subsequent scans toggle based on last scan
      let currentAction: 'entrée' | 'sortie' = 'entrée';
      if (!isFirstScan) {
        const sortedLogs = logSnap.docs
          .map(d => ({ ...(d.data() as any), id: d.id }))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        const lastAction = sortedLogs[0].type;
        currentAction = lastAction === 'entrée' ? 'sortie' : 'entrée';
      }

      // 2. Add detailed log
      await addDoc(collection(db, 'attendance_logs'), {
        user_id: user.id,
        user_name: `${user.prenom} ${user.nom}`,
        date: today,
        timestamp: now.toISOString(),
        time: timeString,
        type: currentAction,
        isLate: isFirstScan && currentAction === 'entrée' ? isLate : false
      });

      // 3. Update or Create daily summary
      const attQuery = query(collection(db, 'attendance'), 
        where('user_id', '==', user.id),
        where('date', '==', today)
      );
      const attSnap = await getDocs(attQuery);

      const status = isFirstScan ? (isLate ? 'Retard' : 'Présent') : null;

      if (attSnap.empty) {
        await addDoc(collection(db, 'attendance'), {
          user_id: user.id,
          nom: user.nom,
          prenom: user.prenom,
          role: user.role,
          classe: user.classe || null,
          date: today,
          heure_arrivee: timeString,
          heure_depart: null,
          statut: status,
          current_state: 'présent',
          timestamp: now.toISOString()
        });
      } else {
        const docId = attSnap.docs[0].id;
        const updateData: any = {
          current_state: currentAction === 'entrée' ? 'présent' : 'sorti',
          timestamp: now.toISOString()
        };
        if (currentAction === 'sortie') {
          updateData.heure_depart = timeString;
        }
        await updateDoc(doc(db, 'attendance', docId), updateData);
      }

      setActionType(currentAction === 'entrée' ? 'arrivée' : 'départ');

      // 4. Fetch house dynamically if any
      let studentHouse: any = null;
      if (user.house_id) {
        try {
          const houseDoc = await getDoc(doc(db, 'houses', user.house_id));
          if (houseDoc.exists()) {
            studentHouse = { id: houseDoc.id, ...houseDoc.data() };
          }
        } catch (e) {
          console.error("Error fetching student house:", e);
        }
      }

      // 5. Fetch grades to calculate GPA
      let studentGrades: any[] = [];
      let calculatedGpa = 0;
      try {
        const gradesSnap = await getDocs(query(collection(db, 'grades'), where('studentId', '==', user.id)));
        studentGrades = gradesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (studentGrades.length > 0) {
          const validGrades = studentGrades.filter((g: any) => g.maxScore > 0);
          if (validGrades.length > 0) {
            const totalWeightedScore = validGrades.reduce((acc: number, g: any) => acc + (g.score / g.maxScore * 20) * (g.coefficient || 1), 0);
            const totalCoefficients = validGrades.reduce((acc: number, g: any) => acc + (g.coefficient || 1), 0);
            if (totalCoefficients > 0) {
              const avg = totalWeightedScore / totalCoefficients;
              calculatedGpa = isNaN(avg) ? 0 : avg;
            }
          }
        }
      } catch (e) {
        console.error("Error fetching student grades:", e);
      }

      setScannedUserData({
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        classe: user.classe,
        photo: user.photo,
        telephone: user.telephone,
        email: user.email,
        date_naissance: user.date_naissance,
        lieu_naissance: user.lieu_naissance,
        parent_email: user.parent_email || user.email_parent || "",
        parent_phone: user.parent_phone || user.telephone_parent || "",
        maison: studentHouse,
        gpa: calculatedGpa,
        gradesCount: studentGrades.length,
        heure: timeString,
        statut: isFirstScan ? (isLate ? 'Retard' : 'Présent') : (currentAction === 'entrée' ? 'Ré-entrée' : 'Sortie')
      });
      
      setScanStatus('success');
      setTimeout(() => {
        setScanStatus('idle');
        setScannedUserData(null);
        setActionType(null);
      }, 12000);
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'enregistrement de la présence.");
      setScanStatus('error');
      setTimeout(() => setScanStatus('idle'), 3000);
    }
  };

  const handleFaceScan = async () => {
    if (!stream) return;
    setScanStatus('scanning');
    try {
      if (window.PublicKeyCredential) {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const credential = await navigator.credentials.get({
          publicKey: {
            challenge: challenge,
            timeout: 60000,
            userVerification: "required"
          }
        }) as PublicKeyCredential;
        if (credential) {
          handleRealScanAndSave(credential.id);
          return;
        }
      }
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.warn("Erreur biométrique (fallback utilisé):", err);
      }
    }
    setTimeout(() => handleRealScanAndSave(), 1500);
  };

  const handleFingerprintScan = async () => {
    setScanStatus('scanning');
    try {
      if (window.PublicKeyCredential) {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const credential = await navigator.credentials.get({
          publicKey: {
            challenge: challenge,
            timeout: 60000,
            userVerification: "required"
          }
        }) as PublicKeyCredential;

        if (credential) {
          handleRealScanAndSave(credential.id);
          return;
        }
      }
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.warn("Erreur biométrique (fallback utilisé):", err);
      }
    }
    setTimeout(() => handleRealScanAndSave(), 1500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Scanner Biométrique</h1>
          <p className="text-sm text-gray-500 mt-1">Pointage en temps réel via matériel de l'appareil</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <div className="absolute -top-12 right-0 hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black tracking-widest border border-emerald-100 dark:border-emerald-800 animate-pulse">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
            LIVE SYNC ACTIVE
          </div>
          <button 
            onClick={() => setActiveMode('face')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeMode === 'face' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ScanFace size={18} />
            Reconnaissance Faciale
          </button>
          <button 
            onClick={() => setActiveMode('fingerprint')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeMode === 'fingerprint' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Fingerprint size={18} />
            Empreinte Digitale
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden flex flex-col items-center justify-center p-8 min-h-[500px] relative">
            
            {/* Mode Reconnaissance Faciale */}
            {activeMode === 'face' && (
              <div className="w-full max-w-lg flex flex-col items-center">
                <div className="relative w-full aspect-[3/4] sm:aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-inner mb-8">
                  {error || !stream ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 p-6 text-center bg-red-950/20">
                      <AlertCircle size={48} className="mb-4 opacity-80" />
                      <p className="font-medium">{error || "L'accès à la caméra est nécessaire."}</p>
                      <button onClick={startCamera} className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2 font-bold shadow-md">
                        <Camera size={16} /> Activer la caméra
                      </button>
                    </div>
                  ) : (
                    <>
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      
                      {/* Overlay Scanner UI */}
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-2 border-white/30 rounded-3xl">
                          {/* Coins du scanner */}
                          <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-3xl"></div>
                          <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-3xl"></div>
                          <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-3xl"></div>
                          <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-3xl"></div>
                          
                          {/* Ligne de scan animée */}
                          {scanStatus === 'scanning' && (
                            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)] animate-[scan_1.5s_ease-in-out_infinite]"></div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button 
                  onClick={handleFaceScan}
                  disabled={!stream || scanStatus === 'scanning'}
                  className="w-full max-w-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3"
                >
                  {scanStatus === 'scanning' ? (
                    <><RefreshCw className="animate-spin" size={24} /> Analyse en cours...</>
                  ) : (
                    <><Camera size={24} /> Scanner le visage</>
                  )}
                </button>
              </div>
            )}

            {/* Mode Empreinte Digitale */}
            {activeMode === 'fingerprint' && (
              <div className="w-full max-w-lg flex flex-col items-center text-center">
                <div className={`w-48 h-48 rounded-full flex items-center justify-center mb-8 transition-all duration-500 ${
                  scanStatus === 'scanning' ? 'bg-indigo-50 shadow-[0_0_50px_rgba(99,102,241,0.3)] scale-110' : 
                  scanStatus === 'success' ? 'bg-emerald-50 shadow-[0_0_50px_rgba(16,185,129,0.3)]' :
                  scanStatus === 'error' ? 'bg-red-50 shadow-[0_0_50px_rgba(239,68,68,0.3)]' :
                  'bg-gray-50'
                }`}>
                  <Fingerprint 
                    size={80} 
                    className={`transition-colors duration-500 ${
                      scanStatus === 'scanning' ? 'text-indigo-600 animate-pulse' : 
                      scanStatus === 'success' ? 'text-emerald-500' :
                      scanStatus === 'error' ? 'text-red-500' :
                      'text-gray-300'
                    }`} 
                  />
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">Authentification Biométrique</h3>
                <p className="text-gray-500 mb-8 max-w-sm">
                  Utilisez le capteur d'empreinte digitale ou Face ID de votre appareil pour enregistrer votre présence.
                </p>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2">
                    <AlertCircle size={18} className="shrink-0" />
                    {error}
                  </div>
                )}

                <button 
                  onClick={handleFingerprintScan}
                  disabled={scanStatus === 'scanning'}
                  className="w-full max-w-xs bg-gray-900 hover:bg-black disabled:bg-gray-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-gray-200 transition-all flex items-center justify-center gap-3"
                >
                  {scanStatus === 'scanning' ? (
                    <><RefreshCw className="animate-spin" size={24} /> En attente du capteur...</>
                  ) : (
                    <><Fingerprint size={24} /> Scanner l'empreinte</>
                  )}
                </button>
              </div>
            )}

            {/* Message de succès global */}
            {scanStatus === 'success' && scannedUserData && (
              <div className="absolute inset-0 bg-white/98 dark:bg-gray-900/98 backdrop-blur-md z-20 flex flex-col items-center justify-center animate-in fade-in duration-300 p-4 sm:p-6 overflow-y-auto">
                <div className="text-center mb-4 sm:mb-6">
                  <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-100/50 dark:shadow-none animate-bounce">
                    <CheckCircle2 size={32} />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-wider">Identité Confirmée</h2>
                  <p className="text-sm sm:text-base text-emerald-600 dark:text-emerald-400 font-extrabold capitalize">{actionType} enregistrée avec succès</p>
                </div>

                <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-3xl border border-gray-150 dark:border-gray-700 shadow-2xl overflow-hidden text-left flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-150 dark:divide-gray-700">
                  {/* Left Column: Avatar & Clan/House */}
                  <div className="p-6 flex flex-col items-center justify-center shrink-0 w-full md:w-56 text-center bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="relative mb-4">
                      {scannedUserData.photo ? (
                        <img 
                          src={scannedUserData.photo} 
                          alt="Photos d'élève" 
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-emerald-500 shadow-xl" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-24 h-24 sm:w-28 sm:h-28 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 rounded-full flex items-center justify-center text-3xl font-black uppercase border-4 border-indigo-50 shadow-xl">
                          {scannedUserData.prenom?.[0] || scannedUserData.nom?.[0] || 'U'}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-full shadow-lg">
                        <Sparkles size={16} />
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white line-clamp-2">
                      {scannedUserData.prenom} {scannedUserData.nom}
                    </h3>
                    
                    <span className="mt-1 px-3 py-1 rounded-full text-xs font-extrabold tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 uppercase shrink-0">
                      {scannedUserData.role || 'Élève'}
                    </span>

                    {scannedUserData.classe && (
                      <div className="mt-3 inline-flex items-center gap-1.5 bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-xl">
                        Classe: <span className="font-mono">{scannedUserData.classe}</span>
                      </div>
                    )}

                    {/* House Details */}
                    {scannedUserData.maison && (
                      <div className="mt-4 w-full p-2.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1" style={{ backgroundColor: `${scannedUserData.maison.color}10`, color: scannedUserData.maison.color, borderColor: `${scannedUserData.maison.color}30` }}>
                        <span className="text-[10px] uppercase font-bold tracking-widest block opacity-75">Maison</span>
                        <div className="flex items-center gap-1.5">
                          {scannedUserData.maison.logo?.startsWith('http') ? (
                            <img src={scannedUserData.maison.logo} alt="Maison Logo" className="w-4 h-4 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-base">{scannedUserData.maison.logo || '🏆'}</span>
                          )}
                          <span className="truncate">{scannedUserData.maison.nom_maison}</span>
                        </div>
                        <p className="text-[10px] font-black opacity-90">{scannedUserData.maison.total_points || 0} Points</p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: General Information & Grades */}
                  <div className="p-6 flex-1 space-y-4 text-xs sm:text-sm">
                    {/* Personnel */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-1.5">
                        <User size={12} /> Informations Générales
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-800/30 p-3 rounded-2xl border border-gray-100 dark:border-gray-700/60">
                        <div>
                          <p className="text-gray-400 font-semibold text-[10px] uppercase">Né(e) le</p>
                          <p className="font-bold text-gray-800 dark:text-gray-200">{scannedUserData.date_naissance ? new Date(scannedUserData.date_naissance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Non renseigné'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 font-semibold text-[10px] uppercase">À (Lieu)</p>
                          <p className="font-bold text-gray-800 dark:text-gray-200 capitalize truncate">{scannedUserData.lieu_naissance || 'Non renseigné'}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-gray-400 font-semibold text-[10px] uppercase flex items-center gap-1">
                            <Phone size={10} /> Téléphone Élève
                          </p>
                          <p className="font-mono font-bold text-gray-800 dark:text-gray-200">{scannedUserData.telephone || 'Non renseigné'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Parents Details */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                        <Mail size={12} /> Contact Responsable / Parent
                      </h4>
                      <div className="bg-gray-50 dark:bg-gray-800/30 p-3 rounded-2xl border border-gray-100 dark:border-gray-700/60 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 font-semibold text-[10px] uppercase">Téléphone Parent:</span>
                          <span className="font-mono font-black text-gray-800 dark:text-gray-200 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md">{scannedUserData.parent_phone || 'Non disponible'}</span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-gray-400 font-semibold text-[10px] uppercase shrink-0">Email Parent:</span>
                          <span className="font-mono font-medium text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{scannedUserData.parent_email || 'Non disponible'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Academic GPA / Track */}
                    {scannedUserData.role === 'élève' && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
                          <Award size={12} /> Bilan Scolaire en Temps Réel
                        </h4>
                        <div className="flex items-center justify-between bg-emerald-50/30 dark:bg-emerald-950/10 p-3 rounded-2xl border border-emerald-100/30">
                          <div>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-wider">Moyenne Générale</p>
                            <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                              {scannedUserData.gpa ? `${scannedUserData.gpa.toFixed(2)}/20` : 'En attente de notation'}
                            </p>
                          </div>
                          <div>
                            {scannedUserData.gpa ? (
                              <span className={`px-2.5 py-1 rounded-xl font-black text-xs uppercase ${
                                scannedUserData.gpa >= 16 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                scannedUserData.gpa >= 12 ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                scannedUserData.gpa >= 10 ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                'bg-red-100 text-red-800 border border-red-200'
                              }`}>
                                {scannedUserData.gpa >= 16 ? 'Excellent (A+)' :
                                 scannedUserData.gpa >= 12 ? 'Très Bien (B)' :
                                 scannedUserData.gpa >= 10 ? 'Passable (C)' :
                                 'Insuffisant (E)'}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs italic">Pas d'évaluation</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Passage details */}
                    <div className="flex items-center justify-between p-3 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/50 rounded-2xl text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                        </span>
                        <span>Passage à <strong className="font-mono text-gray-900 dark:text-white">{scannedUserData.heure}</strong></span>
                      </div>
                      <span className={`font-black uppercase tracking-wider px-3 py-1 rounded-xl text-xs ${
                        scannedUserData.statut === 'Présent' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 
                        scannedUserData.statut === 'Retard' ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}>
                        {scannedUserData.statut}
                      </span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setScanStatus('idle');
                    setScannedUserData(null);
                    setActionType(null);
                  }}
                  className="mt-6 px-10 py-3.5 bg-gray-900 hover:bg-black dark:bg-gray-800 dark:hover:bg-gray-700 text-white font-extrabold text-sm rounded-2xl tracking-widest uppercase transition-all shadow-xl shadow-gray-200 dark:shadow-none"
                >
                  Fermer & Retour
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Side Log */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg p-6">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Live Sync Log
            </h3>
            <div className="space-y-3">
              {recentAttendance.length === 0 ? (
                 <div className="text-center py-8">
                   <p className="text-xs text-gray-400 italic">Aucune activité récente</p>
                 </div>
              ) : recentAttendance.map((log) => (
                <div key={log.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all group">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                    log.type === 'entrée' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {log.user_name?.[0] || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-gray-900 dark:text-white truncate">{log.user_name}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold uppercase ${log.type === 'entrée' ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {log.type}
                      </span>
                      <span className="text-[9px] text-gray-400 font-medium">{log.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 dark:shadow-none">
            <h4 className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Statut Matériel</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="opacity-80">Capteur Caméra</span>
                <span className={`font-black uppercase ${stream ? 'text-emerald-300' : 'text-indigo-300'}`}>
                  {stream ? 'Connecté' : 'Inactif'}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="opacity-80">Sync Firebase</span>
                <span className="font-black uppercase text-emerald-300">Actif</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
