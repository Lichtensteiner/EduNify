import React from 'react';
import { Shield, Lock, FileText, Scale, Globe, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function TermsAndConditions() {
  const { t } = useLanguage();

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => window.history.back()}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
          Conditions d'Utilisation & Droits Réservés
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm space-y-8">
        
        {/* Intro */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
            <Globe size={24} />
            <h2 className="text-xl font-bold">Introduction</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Bienvenue sur Edu-Nify. Les présentes conditions régissent votre utilisation de notre plateforme de gestion scolaire. 
            En accédant à ce service, vous acceptez de vous conformer aux lois en vigueur au Gabon ainsi qu'aux standards universels de protection des données.
          </p>
        </section>

        {/* Protection des Données (Gabon Law) */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
            <Shield size={24} />
            <h2 className="text-xl font-bold">Protection des Données (Loi Gabonaise)</h2>
          </div>
          <div className="space-y-2 text-gray-600 dark:text-gray-400">
            <p>
              Conformément à la **Loi n°001/2011 relative à la protection des données à caractère personnel** au Gabon, 
              Edu-Nify s'engage à :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Ne collecter que les données strictement nécessaires au fonctionnement du service (identifiants, présences, notes).</li>
              <li>Garantir la confidentialité des données biométriques traitées localement.</li>
              <li>Informer les utilisateurs de la finalité de chaque traitement de données.</li>
              <li>Permettre aux utilisateurs (ou leurs tuteurs légaux) d'exercer leur droit d'accès, de rectification et d'opposition.</li>
            </ul>
          </div>
        </section>

        {/* Droits Réservés */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
            <Lock size={24} />
            <h2 className="text-xl font-bold">Droits Réservés & Propriété Intellectuelle</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Tous les contenus présents sur cette application (logiciel, codes, logos, textes, graphismes) sont la propriété exclusive de **Ludo_Consulting**. 
            Toute reproduction, modification ou distribution sans autorisation préalable est strictement interdite et passible de poursuites conformément au Code de la Propriété Intellectuelle.
          </p>
        </section>

        {/* Responsabilités */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
            <FileText size={24} />
            <h2 className="text-xl font-bold">Responsabilité de l'Utilisateur</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            L'utilisateur est responsable de la confidentialité de ses identifiants de connexion. Toute activité effectuée sous son compte est réputée être de son fait. 
            L'usage abusif de la plateforme (messagerie inappropriée, tentative d'intrusion) pourra entraîner une suspension immédiate du compte.
          </p>
        </section>

        {/* Standards Universels (GDPR/RGPD context) */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
            <Scale size={24} />
            <h2 className="text-xl font-bold">Standards Universels</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Bien que basée au Gabon, Edu-Nify s'aligne sur les principes du **RGPD (Règlement Général sur la Protection des Données)** pour offrir un niveau de sécurité optimal, 
            incluant le "Privacy by Design" et la notification de violation de données.
          </p>
        </section>

      </div>

      <div className="text-center text-sm text-gray-500 pb-12">
        Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} | Edu-Nify by Ludo_Consulting
      </div>
    </div>
  );
}
