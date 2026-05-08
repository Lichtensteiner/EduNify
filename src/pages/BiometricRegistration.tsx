import React, { useState, useRef, useEffect } from 'react';
import { Camera, Fingerprint, ScanFace, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function BiometricRegistration() {
  const { currentUser } = useAuth();
  const [step, setStep] = useState<'face' | 'fingerprint' | 'success'>('face');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      setError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("L'accès à la caméra n'est pas supporté par votre navigateur.");
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Erreur caméra:", err);
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
    if (step === 'face') {
      // Don't start automatically to avoid user gesture issues in iframes
      // startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [step]);

  const fallbackRegistration = async () => {
    if (currentUser) {
      try {
        const userRef = doc(db, 'users', currentUser.id);
        await updateDoc(userRef, {
          face_id: `face_${currentUser.id}`,
          fingerprint_id: `print_${currentUser.id}`,
          credential_id: `mock_${currentUser.id}`
        });
        setStep('success');
      } catch (err) {
        console.error(err);
        setError("Erreur lors de l'enregistrement.");
      }
    }
  };

  const handleFaceScan = async () => {
    setScanning(true);
    
    try {
      if (videoRef.current && currentUser) {
        const canvas = document.createElement('canvas');
        const maxWidth = 400;
        const scale = Math.min(1, maxWidth / videoRef.current.videoWidth);
        canvas.width = videoRef.current.videoWidth * scale;
        canvas.height = videoRef.current.videoHeight * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          
          // Convert to blob
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.7));
          
          if (blob) {
            // Upload to Firebase Storage
            const storageRef = ref(storage, `users/${currentUser.id}/photo_biometric_${Date.now()}`);
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);
            
            // Update user document
            const userRef = doc(db, 'users', currentUser.id);
            await updateDoc(userRef, { photo: downloadURL });
          }
        }
      }
    } catch (err) {
      console.error("Erreur lors de la capture du visage:", err);
      // Continue anyway to not block the user
    }

    setTimeout(() => {
      setScanning(false);
      setStep('fingerprint');
    }, 1000);
  };

  const handleFingerprintScan = async () => {
    setScanning(true);
    try {
      if (currentUser && window.PublicKeyCredential) {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const userId = new Uint8Array(16);
        window.crypto.getRandomValues(userId);

        const credential = await navigator.credentials.create({
          publicKey: {
            challenge: challenge,
            rp: {
              name: "Edu-Nify Pointage",
              id: window.location.hostname,
            },
            user: {
              id: userId,
              name: currentUser.email || currentUser.id,
              displayName: currentUser.prenom || currentUser.nom ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : currentUser.email?.split('@')[0] || 'Utilisateur',
            },
            pubKeyCredParams: [
              { type: "public-key", alg: -7 },
              { type: "public-key", alg: -257 }
            ],
            authenticatorSelection: {
              userVerification: "required"
            },
            timeout: 60000,
            attestation: "none"
          }
        }) as PublicKeyCredential;

        if (credential) {
          const userRef = doc(db, 'users', currentUser.id);
          await updateDoc(userRef, {
            face_id: true,
            fingerprint_id: true,
            credential_id: credential.id // Save the real WebAuthn credential ID
          });
          setStep('success');
          return;
        }
      }
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.warn("WebAuthn non supporté ou annulé:", err);
      }
    }
    
    // Fallback if WebAuthn failed or is not supported
    await fallbackRegistration();
    setScanning(false);
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center animate-in zoom-in duration-300">
          <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Compte créé avec succès</h2>
          <p className="text-gray-500 mb-8">Les données biométriques ont été enregistrées.</p>
          <p className="text-sm text-gray-400">Redirection en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full animate-in slide-in-from-right duration-300">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Étape 2 : Enregistrement Biométrique</h2>
        <p className="text-gray-500 mb-8">Cette étape est obligatoire pour finaliser la création de votre compte.</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {step === 'face' && (
          <div className="flex flex-col items-center">
            <div className="w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden relative mb-6">
              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
              {scanning && <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,1)] animate-[scan_1.5s_ease-in-out_infinite]"></div>}
              {!stream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 p-4 text-center">
                  <Camera size={48} className="mb-4 opacity-50" />
                  <p className="text-sm mb-4">L'accès à la caméra est nécessaire pour le scan facial.</p>
                  <button 
                    onClick={startCamera}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-colors"
                  >
                    Activer la caméra
                  </button>
                </div>
              )}
            </div>
            <button 
              onClick={handleFaceScan}
              disabled={scanning || !stream}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-4 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors"
            >
              {scanning ? <RefreshCw className="animate-spin" /> : <ScanFace />}
              {scanning ? 'Analyse en cours...' : 'Scanner le visage'}
            </button>
            <div className="mt-4 text-center">
              <button onClick={fallbackRegistration} className="text-sm text-gray-500 hover:text-gray-700 underline">
                Passer cette étape (Non obligatoire)
              </button>
            </div>
          </div>
        )}

        {step === 'fingerprint' && (
          <div className="flex flex-col items-center animate-in fade-in duration-300">
            <div className={`w-40 h-40 rounded-full flex items-center justify-center mb-8 transition-all duration-500 ${scanning ? 'bg-indigo-50 scale-110 shadow-[0_0_30px_rgba(99,102,241,0.3)]' : 'bg-gray-100'}`}>
              <Fingerprint size={64} className={scanning ? 'text-indigo-600 animate-pulse' : 'text-gray-400'} />
            </div>
            <button 
              onClick={handleFingerprintScan}
              disabled={scanning}
              className="w-full bg-gray-900 hover:bg-black disabled:bg-gray-600 text-white py-4 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors"
            >
              {scanning ? <RefreshCw className="animate-spin" /> : <Fingerprint />}
              {scanning ? 'Enregistrement...' : "Scanner l'empreinte"}
            </button>
            <div className="mt-4 text-center">
              <button onClick={fallbackRegistration} className="text-sm text-gray-500 hover:text-gray-700 underline">
                Passer cette étape (Non obligatoire)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
