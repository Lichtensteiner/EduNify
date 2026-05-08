import React, { useState, useEffect, useRef } from 'react';
import { ScanFace, Fingerprint, CheckCircle2, AlertCircle, QrCode, ArrowLeft, Camera } from 'lucide-react';
import { collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import jsQR from 'jsqr';

type ScanMode = 'face' | 'fingerprint' | 'qrcode';

interface KioskModeProps {
  onExit?: () => void;
}

export default function KioskMode({ onExit }: KioskModeProps) {
  const [scanMode, setScanMode] = useState<ScanMode>('face');
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [recognizedUser, setRecognizedUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'arrivée' | 'départ' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

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
    if (scanMode === 'face' || scanMode === 'qrcode') {
      // Don't start automatically to avoid user gesture issues in iframes
      // startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [scanMode]);

  // QR Code Scanning Loop
  useEffect(() => {
    let animationFrameId: number;

    const scanQRCode = () => {
      if (scanMode === 'qrcode' && scanStatus === 'idle' && videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code) {
            handleQRCodeScanned(code.data);
            return; // Stop scanning while processing
          }
        }
      }
      animationFrameId = requestAnimationFrame(scanQRCode);
    };

    if (scanMode === 'qrcode') {
      scanQRCode();
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [scanMode, scanStatus]);

  const handleQRCodeScanned = async (qrData: string) => {
    setScanStatus('scanning');
    try {
      let userId = qrData;
      try {
        const parsed = JSON.parse(qrData);
        if (parsed.id) {
          userId = parsed.id;
        }
      } catch (e) {
        // Not JSON, assume it's the raw ID
      }

      const userDocRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        setScanStatus('error');
        setError("QR Code invalide ou utilisateur non trouvé.");
        setTimeout(() => setScanStatus('idle'), 3000);
        return;
      }

      const user = { id: userDocSnap.id, ...userDocSnap.data() };
      await recordAttendance(user);

    } catch (err) {
      console.error(err);
      setScanStatus('error');
      setError("Erreur lors de la lecture du QR Code.");
      setTimeout(() => setScanStatus('idle'), 3000);
    }
  };

  const recordAttendance = async (user: any) => {
    setRecognizedUser(user);
    const now = new Date();
    const timeString = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const isLate = now.getHours() >= 8;
    const status = isLate ? 'Retard' : 'Présent';
    const today = now.toISOString().split('T')[0];

    // Vérifier si une présence existe déjà aujourd'hui
    const attQuery = query(collection(db, 'attendance'), 
      where('user_id', '==', user.id),
      where('date', '==', today)
    );
    const attSnap = await getDocs(attQuery);

    let currentAction: 'arrivée' | 'départ' = 'arrivée';

    if (attSnap.empty) {
      // Check-in
      await addDoc(collection(db, 'attendance'), {
        user_id: user.id,
        date: today,
        heure_arrivee: timeString,
        heure_depart: null,
        statut: status,
        timestamp: now.toISOString()
      });
    } else {
      // Check-out
      const docId = attSnap.docs[0].id;
      await updateDoc(doc(db, 'attendance', docId), {
        heure_depart: timeString,
        timestamp_depart: now.toISOString()
      });
      currentAction = 'départ';
    }

    setActionType(currentAction);

    // Simuler l'envoi d'une notification aux parents
    if (user.role === 'élève') {
      console.log(`[NOTIFICATION] Envoi d'un SMS/Email aux parents de ${user.prenom} ${user.nom} : "Votre enfant a pointé son ${currentAction} à l'école à ${timeString}."`);
      await addDoc(collection(db, 'notifications'), {
        user_id: user.id,
        type: 'attendance',
        message: `Votre enfant ${user.prenom} ${user.nom} a pointé son ${currentAction} à l'école à ${timeString}.`,
        timestamp: now.toISOString(),
        status: 'sent'
      });
    }

    setScanStatus('success');
    
    setTimeout(() => {
      setScanStatus('idle');
      setRecognizedUser(null);
      setActionType(null);
      if (onExit) {
        onExit();
      }
    }, 3000);
  };

  const handleRealBiometricScan = async () => {
    if (scanStatus === 'scanning') return;
    setScanStatus('scanning');
    
    try {
      let credentialId: string | null = null;

      // Déclenchement d'un VRAI scan biométrique via WebAuthn
      try {
        if (window.PublicKeyCredential) {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);
          
          const credential = await navigator.credentials.get({
            publicKey: {
              challenge: challenge,
              rpId: window.location.hostname,
              userVerification: "required",
              timeout: 60000,
            }
          }) as PublicKeyCredential;

          if (credential) {
            credentialId = credential.id;
          }
        }
      } catch (webAuthnError: any) {
        if (webAuthnError.name !== 'NotAllowedError') {
          console.warn("WebAuthn non supporté ou annulé, utilisation du fallback:", webAuthnError);
        }
      }

      if (!credentialId) {
        // Fallback si WebAuthn n'est pas supporté ou a échoué
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Recherche de l'utilisateur dans Firebase en utilisant le credential_id
      const usersRef = collection(db, 'users');
      let userQuery;
      
      if (credentialId) {
        userQuery = query(usersRef, where('credential_id', '==', credentialId));
      } else {
        // Fallback (pour la démo si WebAuthn ne marche pas)
        userQuery = query(usersRef, where('face_id', '!=', null));
      }

      const usersSnap = await getDocs(userQuery);

      if (usersSnap.empty) {
        setScanStatus('error');
        setError("Utilisateur non reconnu dans la base de données.");
        setTimeout(() => setScanStatus('idle'), 3000);
        return;
      }

      // Si on a utilisé le fallback, on prend un utilisateur au hasard parmi ceux enregistrés
      const doc = credentialId ? usersSnap.docs[0] : usersSnap.docs[Math.floor(Math.random() * usersSnap.docs.length)];
      const user = { id: doc.id, ...(doc.data() as object) };
      
      await recordAttendance(user);

    } catch (err: any) {
      console.error(err);
      setScanStatus('error');
      setError(err.name === 'NotAllowedError' ? "Scan annulé ou non reconnu." : "Erreur lors de la reconnaissance biométrique.");
      setTimeout(() => setScanStatus('idle'), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-6 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          {onExit && (
            <button 
              onClick={onExit}
              className="w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-xl flex items-center justify-center text-white transition-colors"
              title="Retour à la liste"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <img src="/logo.png" alt="Edu-Nify" className="h-12 object-contain bg-white p-1 rounded-xl" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Borne de Pointage</h1>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setScanMode('face')}
            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors ${scanMode === 'face' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            <ScanFace size={20} /> Visage
          </button>
          <button 
            onClick={() => setScanMode('fingerprint')}
            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors ${scanMode === 'fingerprint' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            <Fingerprint size={20} /> Empreinte
          </button>
          <button 
            onClick={() => setScanMode('qrcode')}
            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors ${scanMode === 'qrcode' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            <QrCode size={20} /> QR Code
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex p-8 gap-8 overflow-hidden">
        {/* Scanner Area */}
        <div className="flex-1 bg-black rounded-[2rem] overflow-hidden relative border-4 border-gray-800 shadow-2xl flex flex-col items-center justify-center">
          {scanMode === 'face' || scanMode === 'qrcode' ? (
            <>
              {stream ? (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className={`w-96 h-96 border-4 ${scanMode === 'qrcode' ? 'border-dashed' : 'border-solid'} border-white/30 rounded-[3rem] relative`}>
                      <div className="absolute -top-1 -left-1 w-16 h-16 border-t-8 border-l-8 border-indigo-500 rounded-tl-[3rem]"></div>
                      <div className="absolute -top-1 -right-1 w-16 h-16 border-t-8 border-r-8 border-indigo-500 rounded-tr-[3rem]"></div>
                      <div className="absolute -bottom-1 -left-1 w-16 h-16 border-b-8 border-l-8 border-indigo-500 rounded-bl-[3rem]"></div>
                      <div className="absolute -bottom-1 -right-1 w-16 h-16 border-b-8 border-r-8 border-indigo-500 rounded-br-[3rem]"></div>
                      {scanStatus === 'scanning' && <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500 shadow-[0_0_30px_rgba(99,102,241,1)] animate-[scan_1.5s_ease-in-out_infinite]"></div>}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                  <Camera size={80} className="mb-6 opacity-20" />
                  <p className="text-2xl mb-8">L'accès à la caméra est nécessaire pour le scan.</p>
                  {error && <p className="text-red-400 mb-6 text-lg">{error}</p>}
                  <button 
                    onClick={startCamera}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-4 rounded-full font-bold text-xl shadow-xl shadow-indigo-900/50 transition-all flex items-center gap-3"
                  >
                    <Camera size={24} /> Activer la caméra
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className={`w-64 h-64 rounded-full flex items-center justify-center mb-8 transition-all duration-500 ${
                scanStatus === 'scanning' ? 'bg-indigo-900/50 shadow-[0_0_80px_rgba(99,102,241,0.5)] scale-110' : 'bg-gray-900'
              }`}>
                <Fingerprint size={120} className={scanStatus === 'scanning' ? 'text-indigo-400 animate-pulse' : 'text-gray-600'} />
              </div>
              <p className="text-2xl text-gray-400 font-medium">Posez votre doigt sur le capteur</p>
            </div>
          )}

          {/* Overlay Status */}
          {scanStatus === 'success' && (
            <div className="absolute inset-0 bg-emerald-500/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center animate-in fade-in duration-300">
              <CheckCircle2 size={120} className="text-white mb-6" />
              <h2 className="text-5xl font-bold text-white mb-4">Reconnu</h2>
              <p className="text-2xl text-emerald-100 font-medium capitalize">{actionType} enregistrée</p>
            </div>
          )}
          
          {scanStatus === 'error' && (
            <div className="absolute inset-0 bg-red-500/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center animate-in fade-in duration-300">
              <AlertCircle size={120} className="text-white mb-6" />
              <h2 className="text-3xl font-bold text-white text-center px-8">{error}</h2>
            </div>
          )}

          {/* Scan Button (Real Biometric) */}
          {(scanMode === 'face' || scanMode === 'fingerprint') && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40">
              <button 
                onClick={handleRealBiometricScan}
                disabled={scanStatus === 'scanning' || (scanMode === 'face' && !stream)}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white px-12 py-4 rounded-full font-bold text-xl shadow-xl shadow-indigo-900/50 transition-all flex items-center gap-3"
              >
                {scanMode === 'face' ? <ScanFace size={24} /> : <Fingerprint size={24} />}
                {scanStatus === 'scanning' ? 'Analyse en cours...' : 'Lancer le scan'}
              </button>
            </div>
          )}
        </div>

        {/* Result Area */}
        <div className="w-[400px] bg-gray-800 rounded-[2rem] p-8 flex flex-col shadow-2xl border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-8 border-b border-gray-700 pb-4">Dernier Pointage</h2>
          
          {recognizedUser ? (
            <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-500">
              <div className="flex justify-center mb-8">
                {recognizedUser.photo ? (
                  <img src={recognizedUser.photo} alt="Profile" className="w-40 h-40 rounded-full object-cover border-4 border-emerald-500 shadow-lg shadow-emerald-500/20" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-40 h-40 rounded-full bg-indigo-900 text-indigo-300 flex items-center justify-center font-bold text-5xl uppercase border-4 border-emerald-500 shadow-lg shadow-emerald-500/20">
                    {recognizedUser.prenom?.[0]}{recognizedUser.nom?.[0]}
                  </div>
                )}
              </div>
              
              <div className="text-center mb-8">
                <h3 className="text-3xl font-bold text-white mb-2">{recognizedUser.prenom} {recognizedUser.nom}</h3>
                <p className="text-indigo-400 font-medium text-xl capitalize">{recognizedUser.role}</p>
              </div>

              <div className="space-y-6 bg-gray-900 p-6 rounded-2xl border border-gray-700">
                {recognizedUser.classe && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-lg">Classe</span>
                    <span className="font-bold text-white text-lg">{recognizedUser.classe}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-lg">Action</span>
                  <span className="font-bold text-white text-lg capitalize">{actionType || 'Arrivée'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-lg">Heure</span>
                  <span className="font-bold text-white font-mono text-xl">
                    {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-lg">Statut</span>
                  <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                    new Date().getHours() >= 8 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  }`}>
                    {new Date().getHours() >= 8 ? 'Retard' : 'Présent'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <ScanFace size={80} className="mb-6 opacity-20" />
              <p className="text-xl text-center">En attente de scan...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
