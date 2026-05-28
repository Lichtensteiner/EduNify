import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(
    (window as any).deferredPrompt || null
  );
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode (already installed)
    const standaloneMode = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    
    setIsStandalone(standaloneMode);

    const handler = (e: any) => {
      // Prevent Chrome from displaying its default mini-infobar prompt
      e.preventDefault();
      // Save the event so it can be handled later
      (window as any).deferredPrompt = e;
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    // If there is already a stashed prompt, keep it
    if ((window as any).deferredPrompt) {
      setInstallPrompt((window as any).deferredPrompt);
    }

    window.addEventListener('beforeinstallprompt', handler);

    const appInstalledHandler = () => {
      console.log("L'application a bien été installée !");
      setInstallPrompt(null);
      (window as any).deferredPrompt = null;
      setIsStandalone(true);
    };

    window.addEventListener('appinstalled', appInstalledHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, []);

  const installApp = async () => {
    // Specific check for iOS devices (Safari does not dispatch the beforeinstallprompt event)
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

    const promptEvent = installPrompt || (window as any).deferredPrompt;
    
    // If Chrome or default browser has not yet dispatched the installation event
    if (!promptEvent) {
      alert(
        "Pour installer l'application sur Chrome : \n" +
        "1. Appuyez sur les trois points (⋮) en haut à droite de Chrome \n" +
        "2. Sélectionnez 'Installer l'application' ou 'Ajouter à l'écran d'accueil'"
      );
      return;
    }

    try {
      // Trigger official installation prompt
      await promptEvent.prompt();

      // Wait for user choice (Accepted or Dismissed)
      const { outcome } = await promptEvent.userChoice;
      console.log(`Réponse de l'utilisateur à l'installation : ${outcome}`);

      if (outcome === 'accepted') {
        setInstallPrompt(null);
        (window as any).deferredPrompt = null;
      }
    } catch (err) {
      console.error("Erreur durant l'installation :", err);
    }
  };

  return { 
    isInstallable: !!installPrompt || !!(window as any).deferredPrompt, 
    installApp, 
    isStandalone 
  };
}
