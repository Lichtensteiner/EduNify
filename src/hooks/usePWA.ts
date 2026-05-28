import { useState, useEffect } from 'react';

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(
    (window as any).deferredPrompt || null
  );
  const [isInstallable, setIsInstallable] = useState(
    !!((window as any).deferredPrompt)
  );
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Détecter si l'application fonctionne déjà en mode autonome (déjà installée)
    const standaloneMode = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    
    setIsStandalone(standaloneMode);

    const handleBeforeInstallPrompt = (e: any) => {
      // Empêcher Chrome d'afficher sa propre mini-infobulle automatique
      e.preventDefault();
      // Sauvegarder l'événement pour pouvoir l'exécuter plus tard
      (window as any).deferredPrompt = e;
      setDeferredPrompt(e);
      setIsInstallable(true);
      
      if (!standaloneMode) {
        setShowInstallBanner(true); // Afficher notre bouton ou bannière d'installation personnalisée
      }
    };

    const handleAppInstalled = () => {
      console.log("L'application a bien été installée !");
      setShowInstallBanner(false);
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsStandalone(true);
    };

    // If there is already a stashed prompt in window, initialize state
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
      setIsInstallable(true);
      if (!standaloneMode) {
        setShowInstallBanner(true);
      }
    }

    // Écouter les événements d'installation
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    // Gestion spécifique pour iOS (Safari ne supporte pas l'événement avant installation)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) {
      alert(
        "Pour installer l'application sur iOS : \n" +
        "1. Appuyez sur le bouton 'Partager' (icône carré avec une flèche) au bas de Safari \n" +
        "2. Faîtes défiler la liste vers le bas \n" +
        "3. Appuyez sur 'Sur l'écran d'accueil'"
      );
      return;
    }

    const promptEvent = deferredPrompt || (window as any).deferredPrompt;

    // Si Chrome ne nous a pas encore fourni l'événement d'installation
    if (!promptEvent) {
      alert(
        "Pour installer l'application sur Chrome : \n" +
        "1. Appuyez sur les trois points (⋮) en haut à droite de Chrome \n" +
        "2. Sélectionnez 'Installer l'application' ou 'Ajouter à l'écran d'accueil'"
      );
      return;
    }

    try {
      // Déclencher l'invite d'installation de Chrome
      await promptEvent.prompt();
      
      // Attendre la réponse de l'utilisateur (Accepté ou Refusé)
      const { outcome } = await promptEvent.userChoice;
      console.log(`Réponse de l'utilisateur à l'installation : ${outcome}`);
      
      if (outcome === 'accepted') {
        (window as any).deferredPrompt = null;
        setDeferredPrompt(null);
        setIsInstallable(false);
        setShowInstallBanner(false);
      }
    } catch (err) {
      console.error("Erreur durant l'installation :", err);
    }
  };

  return { 
    isInstallable, 
    installApp, 
    isStandalone,
    deferredPrompt,
    showInstallBanner,
    setShowInstallBanner
  };
}

