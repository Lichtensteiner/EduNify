import React, { useState, useEffect } from 'react';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, writeBatch, deleteDoc, getDocs } from 'firebase/firestore';
import { 
  ShieldCheck, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Plus, 
  RefreshCw, 
  BookOpen, 
  Utensils, 
  Wallet, 
  ShieldAlert, 
  Users, 
  FileText, 
  Calendar, 
  LayoutDashboard, 
  FileBadge, 
  Search, 
  Award, 
  Info,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

interface ResponsibilityItem {
  id: string; // "role_pageId"
  pageId: string;
  pageLabel: string;
  role: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  mission: string;
  lastUpdated: string;
}

const systemRoles = [
  { id: 'admin', label: 'Administrateur', color: 'indigo' },
  { id: 'personnel administratif', label: 'Personnel Administratif', color: 'emerald' },
  { id: 'enseignant', label: 'Enseignant', color: 'amber' },
  { id: 'élève', label: 'Élève / Étudiant', color: 'sky' },
  { id: 'parent', label: 'Parent d\'élève', color: 'purple' },
  { id: 'cuisinier', label: 'Personnel Cantine', color: 'rose' },
  { id: 'responsable_maternelle', label: 'Responsable de la Maternelle', color: 'pink' },
  { id: 'responsable_primaire', label: 'Responsable du Primaire', color: 'sky' },
  { id: 'responsable_college', label: 'Responsable Collège', color: 'indigo' },
  { id: 'gestionnaire_comptable', label: 'Gestionnaire Comptable', color: 'emerald' },
  { id: 'responsable_pedagogique', label: 'Responsable Pédagogique', color: 'amber' },
  { id: 'surveillant_general', label: 'Surveillant Général', color: 'red' },
  { id: 'surveillant_adjoint', label: 'Surveillant Adjoint', color: 'orange' },
  { id: 'dame_menage', label: 'Dame de Ménage', color: 'teal' },
  { id: 'secretaire_generale', label: 'Secrétaire Générale', color: 'purple' },
  { id: 'secretaire_adjointe', label: 'Secrétaire Adjointe', color: 'fuchsia' },
  { id: 'responsable_it', label: 'Responsable du Matériel Informatique', color: 'cyan' }
];

const systemPages = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard, category: 'Principal' },
  { id: 'directory', label: 'Annuaire & Profils', icon: Users, category: 'Principal' },
  { id: 'messaging', label: 'Messagerie Intégrée', icon: Sparkles, category: 'Principal' },
  { id: 'homework', label: 'Devoirs & Leçons', icon: BookOpen, category: 'Scolarité' },
  { id: 'grades', label: 'Notes & Bulletins', icon: FileText, category: 'Scolarité' },
  { id: 'planning', label: 'Emploi du Temps', icon: Calendar, category: 'Scolarité' },
  { id: 'canteen', label: 'Restauration / Cantine', icon: Utensils, category: 'Vie Scolaire' },
  { id: 'library', label: 'Bibliothèque Numérique', icon: BookOpen, category: 'Vie Scolaire' },
  { id: 'finance', label: 'Suivi Financier', icon: Wallet, category: 'Administration' },
  { id: 'discipline', label: 'Discipline & Sanctions', icon: ShieldAlert, category: 'Administration' },
  { id: 'strategic_optimizations', label: 'Optimisations IA', icon: Sparkles, category: 'Administration' },
  { id: 'document_generator', label: 'Générateur de Documents', icon: FileBadge, category: 'Administration' }
];

// Define professional bootstrap defaults
const defaultResponsibilities: Omit<ResponsibilityItem, 'id'>[] = [
  // Admin 
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'admin', canView: true, canEdit: true, canDelete: true, mission: 'Pilotage stratégique, supervision globale des indicateurs de l\'établissement et des alertes IA.', lastUpdated: new Date().toISOString() },
  { pageId: 'directory', pageLabel: 'Annuaire & Profils', role: 'admin', canView: true, canEdit: true, canDelete: true, mission: 'Gestion complète des comptes utilisateurs, validation des rôles et contrôle des fiches personnelles.', lastUpdated: new Date().toISOString() },
  { pageId: 'messaging', pageLabel: 'Messagerie Intégrée', role: 'admin', canView: true, canEdit: true, canDelete: true, mission: 'Supervision et modération des canaux d\'échange de l\'école.', lastUpdated: new Date().toISOString() },
  { pageId: 'grades', pageLabel: 'Notes & Bulletins', role: 'admin', canView: true, canEdit: true, canDelete: true, mission: 'Supervision des évaluations scolaires et révision administrative globale des bulletins.', lastUpdated: new Date().toISOString() },
  { pageId: 'finance', pageLabel: 'Suivi Financier', role: 'admin', canView: true, canEdit: true, canDelete: true, mission: 'Gestion globale des frais de scolarité, encaissements, balances budgétaires et émission des reçus officiels.', lastUpdated: new Date().toISOString() },
  { pageId: 'discipline', pageLabel: 'Discipline & Sanctions', role: 'admin', canView: true, canEdit: true, canDelete: true, mission: 'Supervision disciplinaire, validation définitive des sanctions graves et attribution des récompenses de maisons.', lastUpdated: new Date().toISOString() },
  { pageId: 'strategic_optimizations', pageLabel: 'Optimisations IA', role: 'admin', canView: true, canEdit: true, canDelete: true, mission: 'Déclenchement et validation des recommandations d\'assiduité et d\'organisation scolaire générées par l\'IA.', lastUpdated: new Date().toISOString() },
  
  // Administrative staff
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'personnel administratif', canView: true, canEdit: true, canDelete: false, mission: 'Suivi opérationnel quotidien des absences, retards et alertes d\'assiduité actives.', lastUpdated: new Date().toISOString() },
  { pageId: 'directory', pageLabel: 'Annuaire & Profils', role: 'personnel administratif', canView: true, canEdit: true, canDelete: false, mission: 'Saisie administrative, mise à jour des coordonnées des élèves et parents, et impression des justificatifs.', lastUpdated: new Date().toISOString() },
  { pageId: 'canteen', pageLabel: 'Restauration / Cantine', role: 'personnel administratif', canView: true, canEdit: true, canDelete: false, mission: 'Suivi du planning des repas, gestion des régimes et validation des réservations.', lastUpdated: new Date().toISOString() },
  { pageId: 'discipline', pageLabel: 'Discipline & Sanctions', role: 'personnel administratif', canView: true, canEdit: true, canDelete: false, mission: 'Enregistrement des signalements de retards réguliers et transmission des convocations aux familles.', lastUpdated: new Date().toISOString() },
  { pageId: 'document_generator', pageLabel: 'Générateur de Documents', role: 'personnel administratif', canView: true, canEdit: true, canDelete: true, mission: 'Production en masse des certificats de scolarité, fiches de présence et bulletins administratifs.', lastUpdated: new Date().toISOString() },

  // Teacher 
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'enseignant', canView: true, canEdit: false, canDelete: false, mission: 'Visualisation des statistiques d\'assiduité de ses propres classes et recommandations IA.', lastUpdated: new Date().toISOString() },
  { pageId: 'homework', pageLabel: 'Devoirs & Leçons', role: 'enseignant', canView: true, canEdit: true, canDelete: true, mission: 'Attribution, planification et correction des travaux à restituer par matière.', lastUpdated: new Date().toISOString() },
  { pageId: 'grades', pageLabel: 'Notes & Bulletins', role: 'enseignant', canView: true, canEdit: true, canDelete: false, mission: 'Saisie des notes d\'évaluation, appréciations trimestrielles et calcul des moyennes de matières.', lastUpdated: new Date().toISOString() },
  { pageId: 'planning', pageLabel: 'Emploi du Temps', role: 'enseignant', canView: true, canEdit: false, canDelete: false, mission: 'Consultation du calendrier des cours, des salles attribuées et des réunions pédagogiques.', lastUpdated: new Date().toISOString() },
  { pageId: 'discipline', pageLabel: 'Discipline & Sanctions', role: 'enseignant', canView: true, canEdit: true, canDelete: false, mission: 'Déclaration des incidents de comportement en classe et alertes de ponctualité ou de participation.', lastUpdated: new Date().toISOString() },

  // Student
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'élève', canView: true, canEdit: false, canDelete: false, mission: 'Suivi personnel de son assiduité, de ses retards et du total des points de maison.', lastUpdated: new Date().toISOString() },
  { pageId: 'homework', pageLabel: 'Devoirs & Leçons', role: 'élève', canView: true, canEdit: false, canDelete: false, mission: 'Visualisation quotidienne des travaux à faire et déclaration d\'achèvement.', lastUpdated: new Date().toISOString() },
  { pageId: 'library', pageLabel: 'Bibliothèque Numérique', role: 'élève', canView: true, canEdit: false, canDelete: false, mission: 'Recherche et consultation des documents pédagogiques et livres disponibles.', lastUpdated: new Date().toISOString() },

  // Parent
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'parent', canView: true, canEdit: false, canDelete: false, mission: 'Suivi global des enfants : assiduité, alertes de comportement, points et bulletins.', lastUpdated: new Date().toISOString() },
  { pageId: 'planning', pageLabel: 'Emploi du Temps', role: 'parent', canView: true, canEdit: false, canDelete: false, mission: 'Consultation du calendrier des cours et des événements nécessitant une présence.', lastUpdated: new Date().toISOString() },
  { pageId: 'grades', pageLabel: 'Notes & Bulletins', role: 'parent', canView: true, canEdit: false, canDelete: false, mission: 'Consultation en direct des évaluations de ses enfants et signature numérique des bulletins.', lastUpdated: new Date().toISOString() },

  // Cuisinier
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'cuisinier', canView: true, canEdit: false, canDelete: false, mission: 'Accès aux notifications de service ou aux demandes particulières.', lastUpdated: new Date().toISOString() },
  { pageId: 'canteen', pageLabel: 'Restauration / Cantine', role: 'cuisinier', canView: true, canEdit: true, canDelete: false, mission: 'Mise à jour quotidienne du menu, gestion des stocks d\'ingrédients et des restrictions alimentaires.', lastUpdated: new Date().toISOString() },

  // Responsable Maternelle
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'responsable_maternelle', canView: true, canEdit: false, canDelete: false, mission: 'Observation des statistiques d\'assiduité, de sieste, et des activités d\'éveil de la maternelle (en temps réel).', lastUpdated: new Date().toISOString() },
  { pageId: 'directory', pageLabel: 'Annuaire & Profils', role: 'responsable_maternelle', canView: true, canEdit: true, canDelete: false, mission: 'Suivi des fiches d\'inscription spécifiques des tout-petits et des fiches de contact des familles (en temps réel).', lastUpdated: new Date().toISOString() },
  { pageId: 'messaging', pageLabel: 'Messagerie Intégrée', role: 'responsable_maternelle', canView: true, canEdit: true, canDelete: false, mission: 'Communication directe et sereine en temps réel avec les assistantes maternelles et les parents.', lastUpdated: new Date().toISOString() },
  { pageId: 'planning', pageLabel: 'Emploi du Temps', role: 'responsable_maternelle', canView: true, canEdit: true, canDelete: false, mission: 'Gestion de l\'agenda des ateliers d\'éveil, des plages de sieste et des récréations adaptées.', lastUpdated: new Date().toISOString() },
  { pageId: 'discipline', pageLabel: 'Discipline & Sanctions', role: 'responsable_maternelle', canView: true, canEdit: true, canDelete: false, mission: 'Suivi bienveillant de l\'évolution comportementale et d\'autonomie en section maternelle.', lastUpdated: new Date().toISOString() },

  // Responsable Primaire
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'responsable_primaire', canView: true, canEdit: false, canDelete: false, mission: 'Tableau de bord de suivi de l\'assiduité et du niveau global du cycle primaire de l\'école.', lastUpdated: new Date().toISOString() },
  { pageId: 'directory', pageLabel: 'Annuaire & Profils', role: 'responsable_primaire', canView: true, canEdit: true, canDelete: false, mission: 'Accès à l\'annuaire des instituteurs, élèves de primaire et gestion des fiches d\'informations.', lastUpdated: new Date().toISOString() },
  { pageId: 'messaging', pageLabel: 'Messagerie Intégrée', role: 'responsable_primaire', canView: true, canEdit: true, canDelete: false, mission: 'Échanges d\'informations réguliers et coordination pédagogique avec les enseignants du primaire.', lastUpdated: new Date().toISOString() },
  { pageId: 'homework', pageLabel: 'Devoirs & Leçons', role: 'responsable_primaire', canView: true, canEdit: true, canDelete: false, mission: 'Suivi de la régularité des devoirs et cahiers de texte numériques du primaire.', lastUpdated: new Date().toISOString() },
  { pageId: 'grades', pageLabel: 'Notes & Bulletins', role: 'responsable_primaire', canView: true, canEdit: false, canDelete: false, mission: 'Consultation et préparation des conseils de classe et des livrets de compétences primaires.', lastUpdated: new Date().toISOString() },

  // Responsable Collège
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'responsable_college', canView: true, canEdit: false, canDelete: false, mission: 'Supervision des indicateurs de réussite, d\'absentéisme et d\'alertes comportementales du collège (temps réel).', lastUpdated: new Date().toISOString() },
  { pageId: 'directory', pageLabel: 'Annuaire & Profils', role: 'responsable_college', canView: true, canEdit: true, canDelete: false, mission: 'Supervision des profils d\'élèves de la 6ème à la 3ème et de leur affectation de classe.', lastUpdated: new Date().toISOString() },
  { pageId: 'messaging', pageLabel: 'Messagerie Intégrée', role: 'responsable_college', canView: true, canEdit: true, canDelete: false, mission: 'Messagerie avec les professeurs principaux, parents d\'élèves de collège et délégations.', lastUpdated: new Date().toISOString() },
  { pageId: 'grades', pageLabel: 'Notes & Bulletins', role: 'responsable_college', canView: true, canEdit: true, canDelete: false, mission: 'Validation pédagogique et verrouillage des bulletins du collège avant émission trimestrielle.', lastUpdated: new Date().toISOString() },
  { pageId: 'discipline', pageLabel: 'Discipline & Sanctions', role: 'responsable_college', canView: true, canEdit: true, canDelete: false, mission: 'Suivi et enregistrement des heures de colle, des punitions et des conseils de discipline.', lastUpdated: new Date().toISOString() },

  // Gestionnaire Comptable
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'gestionnaire_comptable', canView: true, canEdit: false, canDelete: false, mission: 'Visualisation synthétique des entrées de fonds, des factures émises et des alertes de caisse en temps réel.', lastUpdated: new Date().toISOString() },
  { pageId: 'finance', pageLabel: 'Suivi Financier', role: 'gestionnaire_comptable', canView: true, canEdit: true, canDelete: true, mission: 'Encaissement des frais scolaires, gestion des tableaux d\'échéanciers et contrôle budgétaire de l\'école.', lastUpdated: new Date().toISOString() },
  { pageId: 'document_generator', pageLabel: 'Générateur de Documents', role: 'gestionnaire_comptable', canView: true, canEdit: true, canDelete: false, mission: 'Impression en temps réel des reçus règlementaires libératoires et bordereaux financiers.', lastUpdated: new Date().toISOString() },

  // Responsable Pédagogique
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'responsable_pedagogique', canView: true, canEdit: false, canDelete: false, mission: 'Analyse des statistiques éducatives de réussite, d\'assiduité par matière et de progression.', lastUpdated: new Date().toISOString() },
  { pageId: 'homework', pageLabel: 'Devoirs & Leçons', role: 'responsable_pedagogique', canView: true, canEdit: true, canDelete: false, mission: 'Coordination et suivi du respect des programmes officiels à travers les fiches de leçons.', lastUpdated: new Date().toISOString() },
  { pageId: 'grades', pageLabel: 'Notes & Bulletins', role: 'responsable_pedagogique', canView: true, canEdit: true, canDelete: false, mission: 'Harmonisation académique, contrôle de la pondération des notes et de la qualité des évaluations.', lastUpdated: new Date().toISOString() },
  { pageId: 'library', pageLabel: 'Bibliothèque Numérique', role: 'responsable_pedagogique', canView: true, canEdit: true, canDelete: false, mission: 'Validation et enrichissement régulier du fonds documentaire éducatif accessible aux classes.', lastUpdated: new Date().toISOString() },

  // Surveillant Général
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'surveillant_general', canView: true, canEdit: false, canDelete: false, mission: 'Observations des taux de présence instantanés, de l\'assiduité du jour et retards enregistrés.', lastUpdated: new Date().toISOString() },
  { pageId: 'directory', pageLabel: 'Annuaire & Profils', role: 'surveillant_general', canView: true, canEdit: false, canDelete: false, mission: 'Consultation de l\'annuaire pour accéder rapidement aux fiches de contact urgence des familles.', lastUpdated: new Date().toISOString() },
  { pageId: 'discipline', pageLabel: 'Discipline & Sanctions', role: 'surveillant_general', canView: true, canEdit: true, canDelete: true, mission: 'Exécution rigoureuse de la politique d\'assiduité : gestion des absences, retards, et exclusions temporaires.', lastUpdated: new Date().toISOString() },
  { pageId: 'planning', pageLabel: 'Emploi du Temps', role: 'surveillant_general', canView: true, canEdit: false, canDelete: false, mission: 'Suivi des permanences, de l\'occupation des salles d\'étude et du contrôle des heures libres.', lastUpdated: new Date().toISOString() },

  // Surveillant Adjoint
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'surveillant_adjoint', canView: true, canEdit: false, canDelete: false, mission: 'Vérification en temps réel des alertes d\'absence ou de comportement transmises pour contrôle.', lastUpdated: new Date().toISOString() },
  { pageId: 'discipline', pageLabel: 'Discipline & Sanctions', role: 'surveillant_adjoint', canView: true, canEdit: true, canDelete: false, mission: 'Saisie terrain immédiate des retards, vérification des billets d\'entrée et contrôle des circulations.', lastUpdated: new Date().toISOString() },

  // Dame de Ménage
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'dame_menage', canView: true, canEdit: false, canDelete: false, mission: 'Prendre connaissance des informations institutionnelles générales et consignes sanitaires (temps réel).', lastUpdated: new Date().toISOString() },
  { pageId: 'canteen', pageLabel: 'Restauration / Cantine', role: 'dame_menage', canView: true, canEdit: false, canDelete: false, mission: 'Horaires du réfectoire, coordination avec l\'équipe cuisine pour la propreté du self-service.', lastUpdated: new Date().toISOString() },

  // Secrétaire Générale
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'secretaire_generale', canView: true, canEdit: false, canDelete: false, mission: 'Information globale de l\'établissement, suivi du calendrier des réunions institutionnelles en temps réel.', lastUpdated: new Date().toISOString() },
  { pageId: 'directory', pageLabel: 'Annuaire & Profils', role: 'secretaire_generale', canView: true, canEdit: true, canDelete: false, mission: 'Saisie qualifiée, création de dossiers familles d\'élèves et validation des statuts d\'inscription (temps réel).', lastUpdated: new Date().toISOString() },
  { pageId: 'messaging', pageLabel: 'Messagerie Intégrée', role: 'secretaire_generale', canView: true, canEdit: true, canDelete: false, mission: 'Point d\'entrée et dispatching officiel des correspondances reçues par l\'établissement.', lastUpdated: new Date().toISOString() },
  { pageId: 'document_generator', pageLabel: 'Générateur de Documents', role: 'secretaire_generale', canView: true, canEdit: true, canDelete: true, mission: 'Production légale assistée de certificats d\'assiduité, d\'inscriptions, et circulaires de direction.', lastUpdated: new Date().toISOString() },

  // Secrétaire Adjointe
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'secretaire_adjointe', canView: true, canEdit: false, canDelete: false, mission: 'Tenue des agendas opérationnels et convocations d\'élèves ou d\'intervenants.', lastUpdated: new Date().toISOString() },
  { pageId: 'directory', pageLabel: 'Annuaire & Profils', role: 'secretaire_adjointe', canView: true, canEdit: true, canDelete: false, mission: 'Enregistrement de base des fiches d\'adresses, téléphones et correctifs d\'état civil.', lastUpdated: new Date().toISOString() },
  { pageId: 'document_generator', pageLabel: 'Générateur de Documents', role: 'secretaire_adjointe', canView: true, canEdit: true, canDelete: false, mission: 'Impression quotidienne des lettres de relance pour documents administratifs manquants.', lastUpdated: new Date().toISOString() },

  // Responsable du Matériel Informatique (Responsable IT)
  { pageId: 'dashboard', pageLabel: 'Tableau de Bord', role: 'responsable_it', canView: true, canEdit: false, canDelete: false, mission: 'Suivi de l\'état d\'activité des serveurs de l\'école, des terminaux et de la bande passante (temps réel).', lastUpdated: new Date().toISOString() },
  { pageId: 'document_generator', pageLabel: 'Générateur de Documents', role: 'responsable_it', canView: true, canEdit: true, canDelete: false, mission: 'Génération de fiches d\'inventaire matériel informatique d\'élèves et de professeurs.', lastUpdated: new Date().toISOString() }
];

export default function RoleResponsibilities() {
  const { t, tData } = useLanguage();
  const { notifySuccess, notifyError, notifyUpdate } = useNotification();
  const { currentUser } = useAuth();

  const [items, setItems] = useState<ResponsibilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'by_role' | 'by_page'>('by_role');
  const [selectedRole, setSelectedRole] = useState<string>('personnel administratif');
  const [selectedPage, setSelectedPage] = useState<string>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Real-time users list from database
  const [usersList, setUsersList] = useState<any[]>([]);

  // Custom editing states
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingMissionText, setEditingMissionText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New item creation state
  const [newItem, setNewItem] = useState({
    role: 'personnel administratif',
    pageId: 'dashboard',
    canView: true,
    canEdit: false,
    canDelete: false,
    mission: ''
  });

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const u = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsersList(u);
    }, (err) => {
      console.error("Error watching users for counts:", err);
    });
    return () => unsubscribeUsers();
  }, []);

  const getRegisteredUserCount = (roleId: string) => {
    const isResponsibility = [
      'responsable_maternelle', 'responsable_primaire', 'responsable_college', 
      'gestionnaire_comptable', 'responsable_pedagogique', 'surveillant_general', 
      'surveillant_adjoint', 'dame_menage', 'secretaire_generale', 
      'secretaire_adjointe', 'responsable_it'
    ].includes(roleId);

    return usersList.filter(user => {
      const userRole = (user.role || '').toLowerCase();
      const userResp = Array.isArray(user.responsibilities) ? user.responsibilities : [];
      
      if (roleId === 'admin') {
        return userRole === 'admin';
      }
      if (roleId === 'personnel administratif') {
        return userRole === 'personnel administratif';
      }
      if (roleId === 'enseignant') {
        return userRole === 'enseignant';
      }
      if (roleId === 'élève' || roleId === 'eleve') {
        return userRole === 'élève' || userRole === 'eleve';
      }
      if (roleId === 'parent') {
        return userRole === 'parent';
      }
      if (roleId === 'cuisinier') {
        return userRole === 'cuisinier' || userResp.includes('cuisinier');
      }
      
      if (isResponsibility) {
        return userResp.includes(roleId) || userRole === roleId;
      }
      
      return userRole === roleId;
    }).length;
  };

  const getUsersInRole = (roleId: string) => {
    const isResponsibility = [
      'responsable_maternelle', 'responsable_primaire', 'responsable_college', 
      'gestionnaire_comptable', 'responsable_pedagogique', 'surveillant_general', 
      'surveillant_adjoint', 'dame_menage', 'secretaire_generale', 
      'secretaire_adjointe', 'responsable_it'
    ].includes(roleId);

    return usersList.filter(user => {
      const userRole = (user.role || '').toLowerCase();
      const userResp = Array.isArray(user.responsibilities) ? user.responsibilities : [];
      
      if (roleId === 'admin') {
        return userRole === 'admin';
      }
      if (roleId === 'personnel administratif') {
        return userRole === 'personnel administratif';
      }
      if (roleId === 'enseignant') {
        return userRole === 'enseignant';
      }
      if (roleId === 'élève' || roleId === 'eleve') {
        return userRole === 'élève' || userRole === 'eleve';
      }
      if (roleId === 'parent') {
        return userRole === 'parent';
      }
      if (roleId === 'cuisinier') {
        return userRole === 'cuisinier' || userResp.includes('cuisinier');
      }
      
      if (isResponsibility) {
        return userResp.includes(roleId) || userRole === roleId;
      }
      
      return userRole === roleId;
    });
  };

  useEffect(() => {
    if (!isFirebaseConfigured) {
      // Offline fallback: load from standard localStorage with defaults
      const saved = localStorage.getItem('role_responsibilities_local');
      if (saved) {
        const loadedLocal = JSON.parse(saved) as ResponsibilityItem[];
        const loadedIds = new Set(loadedLocal.map(item => item.id));
        const missingDefaults = defaultResponsibilities
          .map(r => ({ id: `${r.role}_${r.pageId}`, ...r } as ResponsibilityItem))
          .filter(r => !loadedIds.has(r.id));
        
        if (missingDefaults.length > 0) {
          const merged = [...loadedLocal, ...missingDefaults];
          localStorage.setItem('role_responsibilities_local', JSON.stringify(merged));
          setItems(merged);
        } else {
          setItems(loadedLocal);
        }
      } else {
        const withIds = defaultResponsibilities.map(r => ({
          id: `${r.role}_${r.pageId}`,
          ...r
        }));
        localStorage.setItem('role_responsibilities_local', JSON.stringify(withIds));
        setItems(withIds);
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'role_responsibilities'), async (snapshot) => {
      const loaded = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ResponsibilityItem));

      const loadedIds = new Set(loaded.map(item => item.id));
      const missingDefaults = defaultResponsibilities.filter(r => !loadedIds.has(`${r.role}_${r.pageId}`));

      if (missingDefaults.length > 0) {
        // We have missing roles configurations, write them to Firestore
        try {
          const batch = writeBatch(db);
          missingDefaults.forEach(r => {
            const id = `${r.role}_${r.pageId}`;
            const ref = doc(db, 'role_responsibilities', id);
            batch.set(ref, r);
          });
          await batch.commit();
        } catch (err) {
          console.error("Bootstrapping missing permissions failed:", err);
          setItems(loaded);
          setLoading(false);
        }
      } else {
        setItems(loaded);
        setLoading(false);
      }
    }, (error) => {
      console.error("Error watching role responsibilities:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdatePermission = async (item: ResponsibilityItem, field: 'canView' | 'canEdit' | 'canDelete', val: boolean) => {
    const updated = { ...item, [field]: val, lastUpdated: new Date().toISOString() };
    
    // Optimistic UI updates
    setItems(prev => prev.map(i => i.id === item.id ? updated : i));

    if (isFirebaseConfigured) {
      try {
        const ref = doc(db, 'role_responsibilities', item.id);
        await setDoc(ref, { [field]: val, lastUpdated: new Date().toISOString() }, { merge: true });
        notifySuccess("Règle mise à jour !");
      } catch (err) {
        notifyError("Erreur lors de la mise à jour");
        console.error(err);
      }
    } else {
      const all = items.map(i => i.id === item.id ? updated : i);
      localStorage.setItem('role_responsibilities_local', JSON.stringify(all));
      notifySuccess("Règle mise à jour localement !");
    }
  };

  const handleSaveMission = async (itemId: string) => {
    if (!editingMissionText.trim()) return;
    
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, mission: editingMissionText, lastUpdated: new Date().toISOString() } : i));
    setEditingItemId(null);

    if (isFirebaseConfigured) {
      try {
        const ref = doc(db, 'role_responsibilities', itemId);
        await updateDoc(ref, { mission: editingMissionText, lastUpdated: new Date().toISOString() });
        notifySuccess("Mission mise à jour !");
      } catch (err) {
        notifyError("Erreur d'édition");
        console.error(err);
      }
    } else {
      const all = items.map(i => i.id === itemId ? { ...i, mission: editingMissionText, lastUpdated: new Date().toISOString() } : i);
      localStorage.setItem('role_responsibilities_local', JSON.stringify(all));
      notifySuccess("Mission mise à jour localement !");
    }
  };

  const handleCreateResponsibility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.mission.trim()) {
      notifyError("Veuillez saisir la description de la responsabilité.");
      return;
    }

    const matchedPage = systemPages.find(p => p.id === newItem.pageId);
    const pageLabel = matchedPage ? matchedPage.label : newItem.pageId;
    const generatedId = `${newItem.role}_${newItem.pageId}`;

    const createdRecord: ResponsibilityItem = {
      id: generatedId,
      pageId: newItem.pageId,
      pageLabel,
      role: newItem.role,
      canView: newItem.canView,
      canEdit: newItem.canEdit,
      canDelete: newItem.canDelete,
      mission: newItem.mission,
      lastUpdated: new Date().toISOString()
    };

    setItems(prev => [createdRecord, ...prev.filter(i => i.id !== generatedId)]);
    setShowAddModal(false);

    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'role_responsibilities', generatedId), {
          pageId: newItem.pageId,
          pageLabel,
          role: newItem.role,
          canView: newItem.canView,
          canEdit: newItem.canEdit,
          canDelete: newItem.canDelete,
          mission: newItem.mission,
          lastUpdated: new Date().toISOString()
        });
        notifySuccess("Responsabilité ajoutée en temps réel !");
      } catch (err) {
        console.error(err);
        notifyError("Erreur d'ajout.");
      }
    } else {
      const updatedList = [createdRecord, ...items.filter(i => i.id !== generatedId)];
      localStorage.setItem('role_responsibilities_local', JSON.stringify(updatedList));
      notifySuccess("Responsabilité ajoutée localement !");
    }

    // Reset Form
    setNewItem({
      role: 'personnel administratif',
      pageId: 'dashboard',
      canView: true,
      canEdit: false,
      canDelete: false,
      mission: ''
    });
  };

  const handleDeleteResponsibility = async (id: string) => {
    if (!window.confirm("Voulez-vous supprimer cette fiche de responsabilité ?")) return;

    setItems(prev => prev.filter(i => i.id !== id));
    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'role_responsibilities', id));
        notifySuccess("Responsabilité supprimée !");
      } catch (err) {
        console.error(err);
        notifyError("Échec de suppression.");
      }
    } else {
      const updated = items.filter(i => i.id !== id);
      localStorage.setItem('role_responsibilities_local', JSON.stringify(updated));
      notifySuccess("Responsabilité supprimée localement !");
    }
  };

  const handleResetToDefaults = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir restaurer les responsabilités usine par défaut ?")) return;
    
    setLoading(true);
    if (isFirebaseConfigured) {
      try {
        const querySnap = await getDocs(collection(db, 'role_responsibilities'));
        const batch = writeBatch(db);
        querySnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        const reBatch = writeBatch(db);
        defaultResponsibilities.forEach(r => {
          const id = `${r.role}_${r.pageId}`;
          reBatch.set(doc(db, 'role_responsibilities', id), r);
        });
        await reBatch.commit();
        notifySuccess("Réinitialisé avec succès !");
      } catch (err) {
        console.error(err);
        notifyError("Erreur de réinitialisation");
      }
    } else {
      const withIds = defaultResponsibilities.map(r => ({
        id: `${r.role}_${r.pageId}`,
        ...r
      }));
      localStorage.setItem('role_responsibilities_local', JSON.stringify(withIds));
      setItems(withIds);
      notifySuccess("Réinitialisé localement !");
    }
    setLoading(false);
  };

  // Filter items matching search and current view filters
  const filteredItems = items.filter(item => {
    const searchMatch = item.pageLabel.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        item.mission.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.role.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!searchMatch) return false;

    if (viewMode === 'by_role') {
      return item.role === selectedRole;
    } else {
      return item.pageId === selectedPage;
    }
  });

  return (
    <div className="space-y-6">
      
      {/* Top Controls Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-750 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Toggle View Mode Switcher */}
        <div className="flex bg-gray-100 dark:bg-gray-900 rounded-2xl p-1 shrink-0 w-fit">
          <button
            type="button"
            onClick={() => setViewMode('by_role')}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              viewMode === 'by_role' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Vue Par Rôle
          </button>
          
          <button
            type="button"
            onClick={() => setViewMode('by_page')}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              viewMode === 'by_page' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Vue Par Module / Page
          </button>
        </div>

        {/* Dynamic Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Rechercher une mission, un rôle ou un module..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-indigo-505 transition-all"
          />
        </div>

        {/* Create and Reset Action Trigger */}
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Plus size={14} /> Ajouter une règle
          </button>
          
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="p-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-750 text-gray-400 hover:text-red-500 rounded-xl border border-gray-100 dark:border-gray-700 transition-all cursor-pointer"
            title="Réinitialiser d'usine"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Main Layout containing Navigation Side-Panel and List View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Navigation/Filter Sidebar for Matrix Selection */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-750 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
              {viewMode === 'by_role' ? 'Rôles à configurer' : 'Modules / Pages'}
            </h3>

            <div className="space-y-1.5">
              {viewMode === 'by_role' ? (
                systemRoles.map(role => {
                  const realUserCount = getRegisteredUserCount(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRole(role.id)}
                      className={`w-full text-left px-3.5 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                        selectedRole === role.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-100 dark:ring-indigo-900/40'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/40 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <span className="capitalize truncate shrink-0 max-w-[130px]" title={role.label}>{role.label}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 whitespace-nowrap ${
                        realUserCount > 0 
                          ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400' 
                          : 'bg-gray-100 dark:bg-gray-750 text-gray-400 dark:text-gray-500'
                      }`}>
                        {realUserCount} {realUserCount > 1 ? 'membres' : 'membre'}
                      </span>
                    </button>
                  );
                })
              ) : (
                systemPages.map(page => {
                  const itemsCount = items.filter(i => i.pageId === page.id).length;
                  const Icon = page.icon;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => setSelectedPage(page.id)}
                      className={`w-full text-left px-3.5 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between ${
                        selectedPage === page.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-100 dark:ring-indigo-900/40'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/40 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={14} className="opacity-70" />
                        {page.label}
                      </span>
                      <span className="text-[10px] bg-gray-200/50 dark:bg-gray-700 px-2 py-0.5 rounded-full font-black">
                        {itemsCount}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Content Area - Responsive Table / Interactive Cards */}
        <div className="lg:col-span-3 space-y-4">
          {viewMode === 'by_role' && (
            <div className="bg-gradient-to-r from-indigo-50/70 to-purple-50/70 dark:from-indigo-950/20 dark:to-purple-950/20 rounded-3xl p-5 border border-indigo-100/60 dark:border-indigo-900/30 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-100 dark:bg-indigo-900/45 text-indigo-650 dark:text-indigo-400 rounded-xl">
                    <UserCheck size={16} />
                  </span>
                  <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    Membres Réels de l'Établissement ({getUsersInRole(selectedRole).length})
                  </h3>
                </div>
                <span className="text-[9px] font-black tracking-widest text-indigo-650 dark:text-indigo-400 bg-indigo-100/60 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full uppercase">
                  Temps Réel Database
                </span>
              </div>
              
              {getUsersInRole(selectedRole).length === 0 ? (
                <div className="text-center py-5 text-xs text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-gray-800/70 rounded-2xl border border-dashed border-gray-150 dark:border-gray-700">
                  Aucun compte d'utilisateur n'est actuellement enregistré avec le rôle ou la responsabilité "<span className="font-bold text-indigo-600 dark:text-indigo-400 capitalize">{systemRoles.find(r => r.id === selectedRole)?.label || selectedRole}</span>" dans la base de données d'Abidjan. Vous pouvez ajouter des membres dans le personnel administratif.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {getUsersInRole(selectedRole).map((user) => (
                    <div key={user.id} className="flex items-center gap-2.5 bg-white dark:bg-gray-800 p-2.5 rounded-2xl border border-gray-100 dark:border-gray-750 shadow-xs">
                      {user.photo ? (
                        <img src={user.photo} alt="" className="w-8 h-8 rounded-xl object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-[10px] uppercase shadow-inner">
                          {user.prenom?.[0] || ''}{user.nom?.[0] || 'U'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {user.prenom} {user.nom}
                        </p>
                        <p className="text-[10px] text-gray-450 dark:text-gray-450 truncate">
                          {user.email || 'Sans adresse-email'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
              <RefreshCw className="animate-spin text-indigo-650 mb-2" size={32} />
              <p className="text-xs text-gray-400">Récupération de la table de sécurité...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 text-center px-4">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-full mb-3">
                <Info size={28} />
              </div>
              <p className="text-sm font-bold text-gray-800 dark:text-white">Aucune règle définie</p>
              <p className="text-xs text-gray-400 max-w-xs mt-1">Vous pouvez ajouter des permissions personnalisées et des fiches rôles avec le bouton ci-dessus.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
              {filteredItems.map((item) => {
                const isEditing = editingItemId === item.id;
                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-750 shadow-sm relative overflow-hidden flex flex-col xl:flex-row xl:items-start gap-4 transition-all hover:border-indigo-100 dark:hover:border-indigo-900/30"
                  >
                    
                    {/* Role Header (when viewing by Modules) */}
                    <div className="flex-1 space-y-3 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1 rounded-xl">
                          {viewMode === 'by_role' ? item.pageLabel : `Rôle : ${systemRoles.find(r => r.id === item.role)?.label || item.role}`}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteResponsibility(item.id)}
                            className="p-1 px-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                            title="Supprimer la règle"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Display / Edit Mission Context */}
                      <div>
                        {isEditing ? (
                          <div className="space-y-2 mt-2">
                            <textarea
                              value={editingMissionText}
                              onChange={(e) => setEditingMissionText(e.target.value)}
                              rows={3}
                              className="w-full text-xs p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                            <div className="flex gap-1.5 justify-end">
                              <button
                                type="button"
                                onClick={() => setEditingItemId(null)}
                                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] font-bold rounded-lg transition-colors"
                              >
                                Annuler
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveMission(item.id)}
                                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-colors"
                              >
                                Enregistrer
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group/mission">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider text-[9px] mb-1">Missions et responsabilités clés :</p>
                            <div className="flex items-start gap-2">
                              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-semibold italic">
                                "{item.mission}"
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItemId(item.id);
                                  setEditingMissionText(item.mission);
                                }}
                                className="p-1 text-gray-400 hover:text-indigo-500 opacity-0 group-hover/mission:opacity-100 transition-opacity shrink-0"
                                title="Modifier la mission"
                              >
                                <Edit3 size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Permissions Config Matrix Toggles */}
                    <div className="border-t xl:border-t-0 xl:border-l border-gray-150/60 dark:border-gray-750 pt-4 xl:pt-0 xl:pl-6 shrink-0 grid grid-cols-3 xl:flex xl:flex-row gap-4 items-center min-w-[300px]">
                      
                      {/* View Permission State */}
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[9px] font-black uppercase text-gray-400 mb-2">Accès / Voir</span>
                        <button
                          type="button"
                          onClick={() => handleUpdatePermission(item, 'canView', !item.canView)}
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                            item.canView 
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 shadow-sm' 
                              : 'bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 border border-red-100/30'
                          }`}
                        >
                          {item.canView ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </div>

                      {/* Edit/Create Permission State */}
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[9px] font-black uppercase text-gray-400 mb-2">Créer / Écrire</span>
                        <button
                          type="button"
                          onClick={() => handleUpdatePermission(item, 'canEdit', !item.canEdit)}
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                            item.canEdit 
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shadow-sm' 
                              : 'bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-500'
                          }`}
                        >
                          <Check size={16} className={item.canEdit ? 'opacity-100' : 'opacity-20'} />
                        </button>
                      </div>

                      {/* Delete Permission State */}
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[9px] font-black uppercase text-gray-400 mb-2">Suppression</span>
                        <button
                          type="button"
                          onClick={() => handleUpdatePermission(item, 'canDelete', !item.canDelete)}
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                            item.canDelete 
                              ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-650 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40 shadow-sm' 
                              : 'bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-500'
                          }`}
                        >
                          <Trash2 size={16} className={item.canDelete ? 'opacity-100' : 'opacity-20'} />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add New Responsibility Card Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-[2.2rem] shadow-2xl max-w-md w-full overflow-hidden border border-white/20 p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-black text-gray-900 dark:text-white">Créer une Mission & Règle</h3>
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 hover:bg-gray-150 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreateResponsibility} className="space-y-4 text-xs font-bold text-gray-700 dark:text-gray-300">
              
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Sélectionner le Rôle</label>
                <select
                  value={newItem.role}
                  onChange={(e) => setNewItem({ ...newItem, role: e.target.value })}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none"
                >
                  {systemRoles.map(role => (
                    <option key={role.id} value={role.id}>{role.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Module d'école concerné</label>
                <select
                  value={newItem.pageId}
                  onChange={(e) => setNewItem({ ...newItem, pageId: e.target.value })}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none"
                >
                  {systemPages.map(page => (
                    <option key={page.id} value={page.id}>{page.label}</option>
                  ))}
                </select>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-3 gap-2 py-2">
                <button
                  type="button"
                  onClick={() => setNewItem({ ...newItem, canView: !newItem.canView })}
                  className={`py-3.5 border rounded-xl flex flex-col items-center gap-1.5 font-bold cursor-pointer transition-all ${
                    newItem.canView 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' 
                      : 'border-gray-200 bg-transparent text-gray-400'
                  }`}
                >
                  <Eye size={14} /> Accès
                </button>

                <button
                  type="button"
                  onClick={() => setNewItem({ ...newItem, canEdit: !newItem.canEdit })}
                  className={`py-3.5 border rounded-xl flex flex-col items-center gap-1.5 font-bold cursor-pointer transition-all ${
                    newItem.canEdit 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20' 
                      : 'border-gray-200 bg-transparent text-gray-400'
                  }`}
                >
                  <Check size={14} /> Écriture
                </button>

                <button
                  type="button"
                  onClick={() => setNewItem({ ...newItem, canDelete: !newItem.canDelete })}
                  className={`py-3.5 border rounded-xl flex flex-col items-center gap-1.5 font-bold cursor-pointer transition-all ${
                    newItem.canDelete 
                      ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/20' 
                      : 'border-gray-200 bg-transparent text-gray-400'
                  }`}
                >
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Description précise de la mission</label>
                <textarea
                  placeholder="Ex: Responsable de la saisie des devoirs, l'attribution des points comportementaux et la notification des retards."
                  value={newItem.mission}
                  onChange={(e) => setNewItem({ ...newItem, mission: e.target.value })}
                  rows={3}
                  className="w-full text-xs p-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none font-medium"
                />
              </div>

              <div className="flex gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-2xl font-black text-xs uppercase transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-grow py-3 bg-indigo-650 hover:bg-indigo-705 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase transition-all shadow-md"
                >
                  Sauvegarder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
