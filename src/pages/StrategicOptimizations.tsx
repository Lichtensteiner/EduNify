import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Sparkles, Download, Trash2, Calendar, Shield, Clock, FileJson, AlertCircle, RefreshCw, UserCheck } from 'lucide-react';

interface PrivateOptimization {
  id: string;
  timestamp: string;
  expiresAt: string;
  optimizedBy: {
    id: string;
    name: string;
    role: string;
  };
  recommendationText: string;
  actionsOptimized: string[];
  schoolStats: {
    presents: number;
    absents: number;
    retards: number;
    total: number;
  };
}

export default function StrategicOptimizations() {
  const { t, tData } = useLanguage();
  const { currentUser } = useAuth();
  const { notifySuccess, notifyError } = useNotification();
  const [optimizations, setOptimizations] = useState<PrivateOptimization[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeNow, setTimeNow] = useState<number>(Date.now());

  // Keep a ticking clock to update real-time expiry countdowns
  useEffect(() => {
    const timer = setInterval(() => setTimeNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Set up live Firestore subscriber and clean up expired documents (older than 48 hours)
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'strategic_optimizations'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const docs = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as any));

      const now = Date.now();
      const expiredDocs: any[] = [];
      const activeDocs: PrivateOptimization[] = [];

      docs.forEach(d => {
        const expiresTime = new Date(d.expiresAt).getTime();
        if (now >= expiresTime) {
          expiredDocs.push(d);
        } else {
          activeDocs.push(d);
        }
      });

      // Realtime automatic cleanup from the DB of expired logs
      if (expiredDocs.length > 0) {
        try {
          const batch = writeBatch(db);
          expiredDocs.forEach((d) => {
            batch.delete(doc(db, 'strategic_optimizations', d.id));
          });
          await batch.commit();
        } catch (err) {
          console.error("Erreur pour la purge automatique des optimisations périmées:", err);
        }
      }

      setOptimizations(activeDocs);
      setLoading(false);
    }, (error) => {
      console.error("Erreur Firestore strategic_optimizations:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const downloadJSONFile = () => {
    if (optimizations.length === 0) return;
    const fileStructure = {
      fileName: "strategic_optimizations.json",
      exportedAt: new Date().toISOString(),
      generator: {
        userId: currentUser?.id,
        userName: `${currentUser?.prenom || ''} ${currentUser?.nom || ''}`.trim(),
        role: currentUser?.role
      },
      entries: optimizations
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(fileStructure, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", "strategic_optimizations.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    notifySuccess("Fichier d'optimisation téléchargé !");
  };

  const clearAllOptimizations = async () => {
    if (optimizations.length === 0) return;
    if (!window.confirm("Êtes-vous sûr de vouloir vider l'historique complet des optimisations stockées en temps réel ?")) {
      return;
    }

    try {
      const q = query(collection(db, 'strategic_optimizations'));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        batch.delete(doc(db, d.ref.path));
      });
      await batch.commit();
      notifySuccess("Historique Firebase vidé avec succès !");
    } catch (error) {
      console.error(error);
      notifyError("Échec de la suppression.");
    }
  };

  // Helper to render remaining time meticulously
  const getExpiresCountdown = (expiresAtStr: string) => {
    const diff = new Date(expiresAtStr).getTime() - timeNow;
    if (diff <= 0) return "Expiré";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const getPercentageLeft = (timestampStr: string, expiresAtStr: string) => {
    const start = new Date(timestampStr).getTime();
    const end = new Date(expiresAtStr).getTime();
    const totalDuration = end - start;
    const elapsed = timeNow - start;
    if (totalDuration <= 0) return 0;
    
    const percent = Math.max(0, Math.min(100, 100 - (elapsed / totalDuration) * 100));
    return percent;
  };

  // Only Auth check for Admin and Enseignant (teacher)
  const isAllowed = currentUser && ['admin', 'enseignant'].includes(currentUser.role);

  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-red-50/50 dark:bg-red-950/10 rounded-3xl border border-red-100 dark:border-red-950/20">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-black text-gray-900 dark:text-white">Accès non autorisé</h2>
        <p className="text-gray-505 dark:text-gray-400 mt-2 max-w-md">
          Seuls les administrateurs et membres du corps enseignant sont habilités à consulter et piloter les optimisations stratégiques.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1 px-2.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-750 dark:text-indigo-400 text-[10px] font-black tracking-widest uppercase rounded-full flex items-center gap-1.5">
              <Sparkles size={11} className="animate-pulse" /> Temps Réel
            </span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            {t('strategic_optimizations')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
            {t('strategic_optimizations_desc')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={downloadJSONFile}
            disabled={optimizations.length === 0}
            className="px-4 py-3 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-750 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-250 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={15} /> Descendre JSON
          </button>
          
          <button
            type="button"
            onClick={clearAllOptimizations}
            disabled={optimizations.length === 0}
            className="px-4 py-3 bg-red-650 hover:bg-red-700 text-white text-xs font-bold rounded-2xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={15} /> Vider l'historique
          </button>
        </div>
      </div>

      {/* Dashboard Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Real-time Status and Statistics Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-55 bg-amber-50 dark:bg-amber-950/30 text-amber-650 dark:text-amber-400 rounded-2xl">
              <Clock size={24} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Persistance 48 Heures</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Règle de disparition stricte</p>
            </div>
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-450 leading-relaxed font-semibold">
            Chaque recommandation enregistrée comporte un marqueur temporel unique de <strong>48 heures</strong>. Passé ce délai, les enregistrements sont d'autorité et en temps réel purgés de la base de données Firestore.
          </p>

          <div className="text-xs border-t border-gray-100 dark:border-gray-700 pt-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Total Validés :</span>
              <span className="font-bold text-gray-900 dark:text-white">{optimizations.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Rôle Actuel :</span>
              <span className="font-bold capitalize text-indigo-600 dark:text-indigo-400">{currentUser?.role}</span>
            </div>
          </div>
        </div>

        {/* Optimizations List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="flex flex-col justify-center items-center py-16 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
              <RefreshCw className="animate-spin text-indigo-600 mb-2" size={32} />
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Chargement des optimisations en temps réel...</p>
            </div>
          ) : optimizations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 text-center">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full mb-4">
                <FileJson size={32} />
              </div>
              <h3 className="text-base font-bold text-gray-800 dark:text-white">Aucun fichier d'optimisation enregistré</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                Rendez-vous dans le tableau de bord, puis cliquez sur "Optimiser" dans la section Recommandation pour créer instantanément une entrée persistante.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {optimizations.map((entry) => {
                const percentLeft = getPercentageLeft(entry.timestamp, entry.expiresAt);
                return (
                  <div
                    key={entry.id}
                    className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden transition-all hover:border-indigo-150/50 dark:hover:border-indigo-900/50"
                  >
                    {/* Visual countdown progress line at the top */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-700">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-indigo-650 transition-all duration-1000"
                        style={{ width: `${percentLeft}%` }}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-1">
                      <div>
                        {/* Meta details */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-[10px] font-mono bg-gray-100 dark:bg-gray-700 text-gray-550 dark:text-gray-350 px-2 py-0.5 rounded-md">
                            ID: {entry.id}
                          </span>
                          <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                            <Shield size={11} /> {entry.optimizedBy.role}
                          </span>
                        </div>
                        
                        <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <span className="text-sm">Par :</span>
                          <span className="text-indigo-600 dark:text-indigo-400">{entry.optimizedBy.name}</span>
                        </div>
                      </div>

                      {/* Expiry Badge and Timer */}
                      <div className="shrink-0 text-left sm:text-right">
                        <span className="text-[10px] font-black uppercase text-amber-550 dark:text-amber-455 text-amber-600 dark:text-amber-400 block mb-1">
                          Disparition Automatique
                        </span>
                        <div className="text-xs font-mono font-black text-amber-500 dark:text-amber-450 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-xl border border-amber-100/50 dark:border-amber-900/20 inline-flex items-center gap-1.5">
                          <Clock size={12} className="animate-spin-slow" /> {getExpiresCountdown(entry.expiresAt)}
                        </div>
                      </div>
                    </div>

                    {/* Recommendation details */}
                    <div className="mt-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100/50 dark:border-gray-800">
                      <h4 className="text-xs font-black text-gray-400 dark:text-gray-550 uppercase tracking-wider mb-2">Recommandation Evaluée</h4>
                      <p className="text-xs text-gray-750 dark:text-gray-300 font-medium leading-relaxed italic">
                        "{entry.recommendationText}"
                      </p>
                    </div>

                    {/* Target Actions & School State */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100/50 dark:border-gray-750">
                      <div>
                        <h4 className="text-xs font-black text-gray-400 dark:text-gray-550 uppercase tracking-wider mb-2">Actions Déclenchées</h4>
                        <ul className="text-xs space-y-1.5 list-disc list-inside text-gray-600 dark:text-gray-450">
                          {(entry.actionsOptimized || []).map((action, actionIdx) => (
                            <li key={actionIdx}>{action}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-xs font-black text-gray-400 dark:text-gray-550 uppercase tracking-wider mb-2">Statuts de l'école</h4>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded-lg">
                            Présents : {entry.schoolStats?.presents || 0}
                          </span>
                          <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-[10px] font-black rounded-lg">
                            Retards : {entry.schoolStats?.retards || 0}
                          </span>
                          <span className="px-2.5 py-1 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[10px] font-black rounded-lg">
                            Absents : {entry.schoolStats?.absents || 0}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-455 dark:text-gray-500 mt-3 font-mono">
                          Enregistré le : {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
