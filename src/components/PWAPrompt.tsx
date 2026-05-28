import React, { useState, useEffect } from 'react';
import { Smartphone, X, Download, Sparkles, Share, Plus, MoreVertical, Monitor, Laptop, CheckCircle2, ChevronRight, HelpCircle, ArrowUp, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePWA } from '../hooks/usePWA';

export default function PWAPrompt() {
  const { isInstallable, installApp, isStandalone } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detectedOS, setDetectedOS] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');

  // Detect Operating System
  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setDetectedOS('ios');
    } else if (/android/.test(userAgent)) {
      setDetectedOS('android');
    } else {
      setDetectedOS('desktop');
    }

    // Listen to custom global triggers to open the install guide
    const handleOpenGuide = () => {
      setModalOpen(true);
    };

    window.addEventListener('open-pwa-install-guide', handleOpenGuide);
    return () => {
      window.removeEventListener('open-pwa-install-guide', handleOpenGuide);
    };
  }, []);

  useEffect(() => {
    // Show banner after a short delay if installable or if we are not standalone, and not dismissed
    // Let's only prompt if we aren't already running inside the installed app
    if (!isStandalone && !dismissed) {
      const timer = setTimeout(() => setBannerVisible(true), 4000);
      return () => clearTimeout(timer);
    } else {
      setBannerVisible(false);
    }
  }, [isInstallable, isStandalone, dismissed]);

  // Handler for primary button click
  const handlePrimaryAction = () => {
    if (isInstallable) {
      installApp();
    } else {
      // If native direct install is not stashed, show the informative modal guide
      setModalOpen(true);
    }
  };

  if (isStandalone) return null;

  return (
    <>
      {/* 1. TOP FLOATING RE-USABLE BANNER */}
      <AnimatePresence>
        {bannerVisible && (
          <motion.div 
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            className="mb-8 w-full"
          >
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white shadow-xl shadow-indigo-500/20 dark:shadow-indigo-950/40">
              {/* Background radial highlight */}
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-indigo-400/20 blur-2xl" />
              
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-center md:text-left flex-1 flex-col sm:flex-row">
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white p-1 border border-white/20 shadow-lg">
                    <img src="/logo.png" alt="Edu-Nify" className="h-full w-full object-contain rounded-xl" referrerPolicy="no-referrer" />
                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white border-2 border-indigo-600 dark:border-indigo-950 shadow-sm">
                      <Download size={10} className="animate-bounce" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black flex items-center justify-center md:justify-start gap-1.5 uppercase tracking-wide">
                      <Sparkles size={14} className="text-amber-300 shrink-0" />
                      {detectedOS === 'desktop' 
                        ? "Installer l'application sur votre Ordinateur" 
                        : "Installer l'application sur votre Mobile"}
                    </h3>
                    <p className="text-xs font-medium text-indigo-100 mt-0.5 leading-relaxed">
                      {detectedOS === 'desktop'
                        ? "Exécutez Edu-Nify directement sur votre PC/Mac avec son icône d'origine, en plein écran ultra-rapide et autonome !"
                        : "Profitez d'une fluidité parfaite et accédez à l'application directement depuis votre écran d'accueil sans passer par l'App Store !"}
                    </p>
                  </div>
                </div>
                
                <div className="flex w-full md:w-auto items-center gap-2 shrink-0">
                  <button
                    onClick={handlePrimaryAction}
                    className="flex flex-1 md:flex-none items-center justify-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-xs font-black text-indigo-600 shadow-md hover:bg-neutral-100 hover:shadow-lg transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
                  >
                    {isInstallable ? <Download size={14} /> : <HelpCircle size={14} />}
                    {isInstallable ? "Installer l'application" : "Guide d'installation"}
                  </button>
                  <button
                    onClick={() => setDismissed(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/25 transition-all cursor-pointer"
                    title="Plus tard"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. THE MULTI-DEVICE DETAILED INSTALL GUIDE MODAL */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 max-h-[90vh] flex flex-col z-10"
            >
              {/* Header block with gradient background */}
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-6 text-white relative">
                <button 
                  onClick={() => setModalOpen(false)}
                  className="absolute right-4 top-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/30 bg-white p-0.5 shadow-md">
                    <img src="/logo.png" alt="Edu-Nify Logo" className="h-full w-full object-contain rounded-lg" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight uppercase">Installation de l'application</h2>
                    <p className="text-xs text-indigo-100">Ajouter <b>Edu-Nify</b> à votre écran de PC ou mobile</p>
                  </div>
                </div>
              </div>

              {/* Install Content */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6 text-gray-700 dark:text-gray-200">
                {isInstallable && (
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex items-center gap-3">
                    <div className="text-indigo-600 dark:text-indigo-400 p-2 bg-white dark:bg-gray-800 rounded-xl">
                      <Download size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">Prêt à installer directement</p>
                      <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">Votre navigateur supporte l'installation directe en un clic.</p>
                    </div>
                    <button 
                      onClick={() => {
                        setModalOpen(false);
                        installApp();
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all active:scale-95"
                    >
                      INSTALLER
                    </button>
                  </div>
                )}

                {/* Segment tabs or customized guidance based on OS */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">Guide par système d'exploitation</h3>
                  
                  {/* Option Tabs switcher to switch view */}
                  <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl text-xs font-bold">
                    <button 
                      onClick={() => setDetectedOS('ios')}
                      className={`py-2 px-3 rounded-xl transition-all ${detectedOS === 'ios' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                    >
                      Apple iOS (iPhone / iPad)
                    </button>
                    <button 
                      onClick={() => setDetectedOS('android')}
                      className={`py-2 px-3 rounded-xl transition-all ${detectedOS === 'android' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                    >
                      Android
                    </button>
                    <button 
                      onClick={() => setDetectedOS('desktop')}
                      className={`py-2 px-3 rounded-xl transition-all ${detectedOS === 'desktop' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                    >
                      Ordinateur / PC
                    </button>
                  </div>

                  {/* GUIDANCE PANELS BASED ON OS CHOICE */}
                  <div className="space-y-4 mt-4 text-xs sm:text-sm">
                    {detectedOS === 'ios' && (
                      <div className="space-y-4">
                        <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300">
                          <Info size={16} className="shrink-0 mt-0.5" />
                          <p><b>Note importante :</b> Sur iOS, vous devez impérativement utiliser le navigateur <b>Safari</b> pour installer l'application.</p>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex gap-4 items-start">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">1</div>
                            <p className="leading-relaxed">
                              Ouvrez l'application dans <b>Safari</b> et regardez la barre de navigation en bas de votre iPhone ou en haut de votre iPad.
                            </p>
                          </div>
                          
                          <div className="flex gap-4 items-start">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">2</div>
                            <div className="leading-relaxed">
                              Appuyez sur le bouton de <b>Partager</b> <Share size={16} className="inline-block mx-1 text-indigo-600 bg-indigo-100 dark:bg-indigo-900 p-0.5 rounded" /> (le carré contenant une flèche pointant vers le haut).
                            </div>
                          </div>

                          <div className="flex gap-4 items-start">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">3</div>
                            <div className="leading-relaxed">
                              Faites défiler le menu de partage de Safari vers le bas et sélectionnez <b>Sur l'écran d'accueil</b> <Plus size={16} className="inline-block mx-1 text-indigo-600 bg-indigo-100 dark:bg-indigo-900 p-0.5 rounded" />.
                            </div>
                          </div>

                          <div className="flex gap-4 items-start">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">4</div>
                            <div className="leading-relaxed">
                              Donnez-lui le nom "Edu-Nify" s'il n'est pas déjà saisi et appuyez sous <b>Ajouter</b> dans le coin supérieur droit.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {detectedOS === 'android' && (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex gap-4 items-start">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">1</div>
                            <div className="leading-relaxed">
                              Ouvrez l'application sur votre appareil Android dans votre navigateur (<b>Chrome</b> recommandé).
                            </div>
                          </div>

                          <div className="flex gap-4 items-start">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">2</div>
                            <div className="leading-relaxed flex-1">
                              Appuyez sur les <b>trois petits points verticaux</b> <MoreVertical size={16} className="inline-block mx-1 text-gray-600" /> dans le coin supérieur ou inférieur droit pour ouvrir le menu d'options de Chrome.
                            </div>
                          </div>

                          <div className="flex gap-4 items-start">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">3</div>
                            <div className="leading-relaxed">
                              Recherchez et appuyez sur l'option <b>Installer l'application</b> ou <b>Ajouter à l'écran d'accueil</b>.
                            </div>
                          </div>

                          <div className="flex gap-4 items-start">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">4</div>
                            <div className="leading-relaxed">
                              Confirmez et le système Android créera une icône sur votre écran d'accueil comme s'il s'agissait du Play Store !
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {detectedOS === 'desktop' && (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex gap-4 items-start">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">1</div>
                            <div className="leading-relaxed">
                              Sur <b>Chrome, Edge ou Opera</b>, regardez à droite dans la barre d'adresse du navigateur.
                            </div>
                          </div>

                          <div className="flex gap-4 items-start">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">2</div>
                            <div className="leading-relaxed flex items-center gap-1.5 flex-wrap">
                              Cliquez sur l'icône de téléchargement <Download size={15} className="text-indigo-600" /> ou l'icône d'ordinateur à droite de l'URL.
                            </div>
                          </div>

                          <div className="flex gap-4 items-start">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">3</div>
                            <div className="leading-relaxed">
                              Cliquez sur <b>Installer</b> dans la pop-up de confirmation. Une icône sera automatiquement ajoutée à votre bureau.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer success indicator */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-3xl text-center space-y-1">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Une fois installée</p>
                  <p className="text-xs text-gray-400">Pourrez utiliser Edu-Nify en mode plein écran autonome, avec des performances de premier ordre !</p>
                </div>
              </div>

              {/* Action buttons at base */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-end gap-2 shrink-0">
                <button 
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

