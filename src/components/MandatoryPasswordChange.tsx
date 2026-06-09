import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { updatePassword, getAuth } from 'firebase/auth';
import { ShieldCheck, Eye, EyeOff, Lock, AlertCircle, Check, X } from 'lucide-react';
import { motion } from 'motion/react';

export default function MandatoryPasswordChange() {
  const { currentUser, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Complexity states
  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasDigit = /[0-9]/.test(newPassword);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  
  const isComplex = hasMinLength && hasUpperCase && hasLowerCase && hasDigit && hasSpecialChar;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentUser) {
      setError("Aucun utilisateur n'est connecté.");
      return;
    }

    if (!isComplex) {
      setError("Le mot de passe ne respecte pas les critères de sécurité exigés.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      // 1. Update password in Firebase Auth
      const auth = getAuth();
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
      } else {
        throw new Error("Impossible d'accéder à la session d'authentification actuelle.");
      }

      // 2. Mark mustChangePassword as false in Firestore
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        mustChangePassword: false,
        temporaryPassword: null
      });

      setSuccess(true);
    } catch (err: any) {
      console.error("Erreur lors de la mise à jour du mot de passe:", err);
      // Firebase auth often requires a recent login to change password. If this occurs, we notify them to log out and re-log in
      if (err?.code === 'auth/requires-recent-login' || err?.message?.includes('requires-recent-login')) {
        setError("⚠️ Par mesure de sécurité, la modification du mot de passe requiert une connexion récente. Veuillez vous déconnecter et vous reconnecter avec votre mot de passe temporaire pour procéder.");
      } else {
        setError(err?.message || "Une erreur est survenue lors du changement de mot de passe.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-900 shadow-xl rounded-3xl p-8 max-w-md w-full border border-gray-100 dark:border-slate-800 text-center space-y-6"
        >
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck size={36} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Mot de passe modifié !</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
              Votre mot de passe a été mis à jour avec succès. Vous bénéficiez désormais d'un accès sécurisé complet à la plateforme Edu-Nify.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 transition-colors"
          >
            Accéder à mon espace
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-4">
        <div className="inline-flex p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-3xl border border-indigo-100 dark:border-indigo-900/60 shadow-inner">
          <Lock className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            Première connexion obligatoire
          </h2>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 leading-normal max-w-sm mx-auto">
            Pour des raisons de sécurité, vous devez remplacer votre mot de passe temporaire par un mot de passe personnel robuste avant de continuer.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-xl rounded-3xl border border-gray-100 dark:border-slate-800">
          {error && (
            <div className="mb-6 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-xs border border-rose-100 dark:border-rose-900/40 flex items-start gap-2">
              <AlertCircle className="shrink-0 mt-0.5 text-rose-500" size={16} />
              <div className="font-semibold leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Nouveau mot de passe
              </label>
              <div className="mt-1 relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 pr-10 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                  placeholder="Saisissez votre nouveau mot de passe"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Confirmer le mot de passe
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                placeholder="Confirmez votre nouveau mot de passe"
              />
            </div>

            {/* Password Complexity Requirements Visualizer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-gray-150 dark:border-slate-800 space-y-2.5">
              <p className="text-xs font-black text-slate-850 dark:text-slate-300 uppercase tracking-wide">
                Exigences de complexité de mot de passe :
              </p>
              
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  {hasMinLength ? (
                    <Check size={14} className="text-emerald-500" />
                  ) : (
                    <X size={14} className="text-slate-400" />
                  )}
                  <span className={`${hasMinLength ? 'text-emerald-600 font-medium' : 'text-gray-500'}`}>
                    Au moins 8 caractères (Saisi : {newPassword.length})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {hasUpperCase ? (
                    <Check size={14} className="text-emerald-500" />
                  ) : (
                    <X size={14} className="text-slate-400" />
                  )}
                  <span className={`${hasUpperCase ? 'text-emerald-600 font-medium' : 'text-gray-500'}`}>
                    Au moins une lettre majuscule (A-Z)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {hasLowerCase ? (
                    <Check size={14} className="text-emerald-500" />
                  ) : (
                    <X size={14} className="text-slate-400" />
                  )}
                  <span className={`${hasLowerCase ? 'text-emerald-600 font-medium' : 'text-gray-500'}`}>
                    Au moins une lettre minuscule (a-z)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {hasDigit ? (
                    <Check size={14} className="text-emerald-500" />
                  ) : (
                    <X size={14} className="text-slate-400" />
                  )}
                  <span className={`${hasDigit ? 'text-emerald-600 font-medium' : 'text-gray-500'}`}>
                    Au moins un chiffre (0-9)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {hasSpecialChar ? (
                    <Check size={14} className="text-emerald-500" />
                  ) : (
                    <X size={14} className="text-slate-400" />
                  )}
                  <span className={`${hasSpecialChar ? 'text-emerald-600 font-medium' : 'text-gray-500'}`}>
                    Au moins un caractère spécial (!@#$%^&*)
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading || !isComplex}
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? "Enregistrement en cours..." : "Valider et sécuriser mon compte"}
              </button>

              <button
                type="button"
                onClick={logout}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all text-xs"
              >
                Annuler et se déconnecter
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
