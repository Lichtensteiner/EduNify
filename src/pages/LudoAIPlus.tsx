import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  Timestamp, 
  addDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { generateAIContent } from '../services/aiService';
import { recordAuditLog } from '../services/auditService';
import { 
  Sparkles, 
  TrendingUp, 
  BrainCircuit, 
  Target, 
  BookOpen, 
  ChevronRight,
  ArrowRight,
  Calendar,
  AlertCircle,
  Lightbulb,
  CheckCircle2,
  FileText,
  Award,
  Send,
  MessageSquare,
  Plus,
  Trash2,
  Users,
  BookOpenCheck,
  UploadCloud,
  Check,
  Loader2,
  X,
  FileSpreadsheet,
  Settings,
  HelpCircle,
  Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import SuccessModal from '../components/SuccessModal';
import { SCHOOL_SUBJECTS } from '../constants';

interface Grade {
  subject: string;
  score: number;
  maxScore: number;
  date: any;
  title: string;
  type?: 'interrogation' | 'evaluation';
}

interface AnalysisResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: {
    subject: string;
    action: string;
    priority: 'High' | 'Medium' | 'Low';
  }[];
  revisionPlan: {
    day: string;
    tasks: string[];
  }[];
  metrics: {
    avgInterrogations: number;
    avgEvaluations: number;
    generalAvg: number;
    percentage: number;
    mention: string;
  };
}

interface ClassroomItem {
  id: string;
  nom: string;
  professeur_principal_id?: string;
  timestamp?: string;
}

const LudoAIPlus: React.FC = () => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  
  // Student view states
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  
  // Custom states for Teachers / Admins / Staff
  const [classesList, setClassesList] = useState<ClassroomItem[]>([]);
  const [classesLoading, setClassesLoading] = useState<boolean>(true);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [subjectsList, setSubjectsList] = useState<{ id: string, name: string }[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState<boolean>(true);
  const [subject, setSubject] = useState<string>('');
  const [theme, setTheme] = useState<string>('');
  const [contentType, setContentType] = useState<string>('Leçon / Note de cours');
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [draftTitle, setDraftTitle] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  });
  
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', text: string }[]>([]);
  const [isApplyingChange, setIsApplyingChange] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishSuccess, setPublishSuccess] = useState<boolean>(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'preview' | 'editor'>('preview');
  
  const [error, setError] = useState<string | null>(null);

  // Load appropriate data based on role
  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.role === 'élève') {
      fetchGrades();
    } else {
      fetchClassesForTeacher();
      
      setSubjectsLoading(true);
      const unsubscribe = onSnapshot(collection(db, 'subjects'), (snap) => {
        const subjectsData = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));
        setSubjectsList(subjectsData.sort((a, b) => a.name.localeCompare(b.name)));
        setSubjectsLoading(false);
      }, (err) => {
        console.error("Error fetching subjects for dropdown:", err);
        setSubjectsLoading(false);
      });
      return () => unsubscribe();
    }
  }, [currentUser]);

  // Fetch student grades for analysis
  const fetchGrades = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const q = query(
        collection(db, 'grades'),
        where('studentId', '==', currentUser.id)
      );
      
      const snap = await getDocs(q);
      let gradesData = snap.docs.map(doc => doc.data() as Grade);
      
      // Filter by date client-side
      gradesData = gradesData.filter(g => {
        const gradeDate = g.date?.toDate ? g.date.toDate() : new Date(g.date);
        return gradeDate >= threeMonthsAgo;
      });

      setGrades(gradesData);
      
      if (gradesData.length > 0) {
        await analyzeWithAI(gradesData);
      }
    } catch (err) {
      console.error("Error fetching grades:", err);
      setError("Impossible de charger vos notes pour l'analyse.");
    } finally {
      setLoading(false);
    }
  };

  // Analyze grades with Gemini (for student)
  const analyzeWithAI = async (data: Grade[]) => {
    setAnalyzing(true);
    setError(null);
    try {
      const prompt = `
        En tant que tuteur pédagogique expert nommé Ludo AI+, analyse les notes suivantes d'un élève sur les 3 derniers mois :
        ${JSON.stringify(data.map(g => ({ 
          subject: g.subject, 
          score: g.score, 
          max: g.maxScore, 
          type: g.type || 'interrogation',
          date: g.date?.toDate?.().toLocaleDateString() || 'N/A' 
        })))}
        
        L'élève s'appelle ${currentUser?.prenom}.
        
        SYSTÈME DE CALCUL OBLIGATOIRE :
        1. Sépare les notes en deux groupes : "Interrogations" (petites évaluations) et "Évaluations Période" (devoirs importants).
        2. Calcule la Moyenne des Interrogations (somme des scores / nombre).
        3. Calcule la Moyenne des Évaluations Période (somme des scores / nombre).
        4. Calcule la Moyenne Générale : (Moyenne Interrogations + Moyenne Évaluations) / 2.
        5. Calcule le Pourcentage : (Moyenne Générale / 20) * 100.
        6. Détermine la Mention selon l'échelle suivante :
           - 16+ : Excellent
           - 14-16 : Très Bien
           - 12-14 : Bien
           - 10-12 : Assez Bien
           - 8-10 : Passable
           - < 8 : Insuffisant
         
        Ta mission :
        1. Résumer ses performances globales.
        2. Identifier ses points forts (matières où il excelle).
        3. Identifier ses points faibles (matières ou sujets nécessitant une attention).
        4. Proposer des recommandations concrètes d'actions par matière.
        5. Créer un plan de révision hebdomadaire structuré.
         
        Réponds UNIQUEMENT au format JSON avec la structure suivante :
        {
          "summary": "string",
          "strengths": ["string"],
          "weaknesses": ["string"],
          "recommendations": [{"subject": "string", "action": "string", "priority": "High|Medium|Low"}],
          "revisionPlan": [{"day": "Lundi", "tasks": ["string"]}],
          "metrics": {
            "avgInterrogations": number,
            "avgEvaluations": number,
            "generalAvg": number,
            "percentage": number,
            "mention": "string"
          }
        }
      `;

      const response = await generateAIContent({
        model: "gemini-3.5-flash",
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text || '{}') as AnalysisResult;
      setAnalysis(result);
    } catch (err: any) {
      console.error("AI Analysis Error:", err);
      setError(`Ludo AI+ a rencontré une erreur lors de l'analyse : ${err?.message || "Erreur de connexion"}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // Fetch classes from 'classes' collection (for teachers/staff)
  const fetchClassesForTeacher = async () => {
    setClassesLoading(true);
    try {
      const snap = await getDocs(collection(db, 'classes'));
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ClassroomItem[];
      setClassesList(list);
      
      // Auto-select first class by default if available
      if (list.length > 0) {
        // If teacher is associated with certain classes, choose the first. Else any first class.
        const teacherClass = list.find(c => currentUser?.classes?.includes(c.nom) || c.professeur_principal_id === currentUser?.id);
        setSelectedClass(teacherClass ? teacherClass.nom : (list[0].nom || ''));
      }
    } catch (err) {
      console.error("Error loading classes for AI selection list:", err);
    } finally {
      setClassesLoading(false);
      setLoading(false);
    }
  };

  // Generate support pedagogical content
  const handleGenerateFormation = async () => {
    if (!selectedClass) {
      setError("Veuillez sélectionner la classe à laquelle est destinée cette formation.");
      return;
    }
    if (!subject.trim()) {
      setError("Veuillez saisir la matière concernée (ex: Mathématiques, Français...).");
      return;
    }
    if (!theme.trim()) {
      setError("Veuillez définir un thème principal pour la formation.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedContent('');
    setChatMessages([]);
    setActiveWorkspaceTab('preview');

    try {
      const prompt = `
        En tant qu'assistant pédagogique expert et tuteur nommé Ludo AI+, rédige un contenu éducatif complet et rigoureux très bien structuré destiné aux élèves de la classe de "${selectedClass}".
        
        Paramètres du support :
        - Matière : "${subject}"
        - Thème / Leçon : "${theme}"
        - Type de support demandé : "${contentType}"
        - Instructions additionnelles de l'enseignant : "${additionalInstructions || "Aucune consigne particulière."}"
        
        Exigences académiques obligatoires :
        1. Rédige un contenu éducatif approfondi, attrayant et adapté aux capacités intellectuelles de cette classe spécifique.
        2. Inclus des définitions de termes clés, des cas illustrés pratiques, de courts exemples concrets de la vie réelle, et 2 ou 3 questions d'entraînement (exercices corrigés ou auto-évaluation) à la fin.
        3. Rédige tout le support au format Markdown fluide et esthétique (titres, listes à points, tableaux, blocs de code, formules ou citations).
        4. Donne directement le contenu rédigé : AUCUN bavardage ou salutations autour ("Voici votre leçon...", "J'espère que cela vous plaira..."), commence directement par le titre de la leçon.
      `;

      const response = await generateAIContent({
        model: "gemini-3.5-flash",
        contents: { parts: [{ text: prompt }] }
      });

      if (response && response.text) {
        setGeneratedContent(response.text);
        setDraftTitle(`${contentType} : ${theme}`);
        setChatMessages([{
          role: 'assistant',
          text: `Bonjour ! J'ai rédigé le support pédagogique **"${theme}"** pour votre classe de **${selectedClass}**. Vous pouvez maintenant me faire part de vos commentaires pour le repolir ou modifier certaines informations ci-dessous !`
        }]);
      } else {
        throw new Error("L'Assistant a retourné une réponse vide.");
      }
    } catch (err: any) {
      console.error("Error generating training:", err);
      setError(`Échec de la génération : ${err.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Chat conversation loop with AI to process revisions
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !generatedContent) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsApplyingChange(true);
    setError(null);

    try {
      const systemPrompt = `
        Tu es Ludo AI+, l'assistant de formation pour enseignants de notre école.
        Voici la version de brouillon actuelle du cours/support générée :
        ---
        ${generatedContent}
        ---
        
        L'enseignant souhaite converser avec toi pour modifier ce document. Son instruction est :
        "${userMessage}"
        
        Ta tâche :
        Ré-écris l'ensemble de la formation en appliquant rigoureusement les modifications demandées (par exemple, ajuster le niveau de difficulté, rajouter une section d'exercices, simplifier le vocabulaire, corriger des éléments, ou traduire une partie).
        Sortie obligatoire : Renvoie UNIQUEMENT le code Markdown global final entièrement mis à jour. Aucun texte de bavardage introductif ou conclusif en dehors du contenu à intégrer.
      `;

      const response = await generateAIContent({
        model: "gemini-3.5-flash",
        contents: { parts: [{ text: systemPrompt }] }
      });

      if (response && response.text) {
        setGeneratedContent(response.text);
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          text: `Modification prise en compte ! J'ai ajusté le contenu scolaire en appliquant votre consigne : "${userMessage}". Le support révisé est disponible ci-dessus.`
        }]);
      } else {
        throw new Error("Aucun texte reçu de l'Assistant Ludo AI.");
      }
    } catch (err: any) {
      console.error("Conversation update error:", err);
      setError(`Erreur lors de la mise à jour par l'IA : ${err.message || err}`);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: `Désolé, je n'ai pas pu appliquer vos ajustements en raison d'une erreur technique : ${err.message || "Panne de communication"}.`
      }]);
    } finally {
      setIsApplyingChange(false);
    }
  };

  // Publish final adjusted content as homework / lesson material to class members
  const handlePublishToClass = async () => {
    if (!currentUser || !selectedClass || !generatedContent) return;
    setIsPublishing(true);
    setError(null);

    try {
      // Add document directly to the homework collection so students of selected class see it
      await addDoc(collection(db, 'homework'), {
        classId: selectedClass, // Matches student's current class name standard
        subject: subject || 'Général',
        title: draftTitle || `${contentType} : ${theme}`,
        description: generatedContent,
        dueDate: new Date(dueDate), // Due date chosen by teacher
        createdAt: new Date(),
        teacherId: currentUser.id,
        teacherName: `${currentUser.prenom} ${currentUser.nom}`,
        completedBy: [],
        isAiGenerated: true
      });

      // Track in security audit logging
      await recordAuditLog({
        userId: currentUser.id,
        userName: `${currentUser.prenom} ${currentUser.nom}`,
        userRole: currentUser.role,
        action: "Publication IA Assist",
        details: `Formation IA : ${draftTitle} affectée à la classe de ${selectedClass}`,
        category: 'homework'
      });

      setPublishSuccess(true);
    } catch (err: any) {
      console.error("Error publishing homework:", err);
      setError(`Une erreur est survenue lors de la publication : ${err.message || err}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // Reset workspace
  const handleResetWorkspace = () => {
    setGeneratedContent('');
    setChatMessages([]);
    setTheme('');
    setAdditionalInstructions('');
    setError(null);
  };

  // RENDER STUDENT MODULE (Original functionality preserved)
  if (currentUser?.role === 'élève') {
    return (
      <div className="p-4 sm:p-6 space-y-8 max-w-5xl mx-auto pb-20">
        {/* Header Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white shadow-2xl shadow-indigo-200 dark:shadow-none">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="space-y-3 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
                <Sparkles size={14} />
                AI-Powered Tutoring
              </div>
              <h1 className="text-4xl font-black tracking-tight">Ludo AI+</h1>
              <p className="text-indigo-100 max-w-md">Bonjour {currentUser.prenom} ! J'ai analysé tes notes des 3 derniers mois pour t'aider à exceller.</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/20">
                 <BrainCircuit size={48} className="text-white animate-pulse" />
              </div>
              <span className="text-xs font-medium opacity-80">Analyse de tes données</span>
            </div>
          </div>
          
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"></div>
        </section>

        {loading || analyzing ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-100 dark:border-gray-700 text-center space-y-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 border-4 border-indigo-100 dark:border-gray-700 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="text-indigo-600 animate-bounce" size={24} />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold dark:text-white">Analyse en cours...</h2>
              <p className="text-gray-500 mt-2">Ludo AI+ examine tes {grades.length} dernières évaluations selon le système de pondération.</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-100 dark:border-red-900/50 flex items-center gap-4">
            <AlertCircle className="text-red-600 shrink-0" size={32} />
            <div>
              <h3 className="text-red-900 dark:text-red-300 font-bold">Oups ! Quelque chose s'est mal passé</h3>
              <p className="text-red-700 dark:text-red-400">{error}</p>
              <button onClick={fetchGrades} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors">Réessayer</button>
            </div>
          </div>
        ) : analysis ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-sans">
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm text-center">
                  <p className="text-xs text-gray-500 uppercase font-black tracking-widest mb-1">Interrogations</p>
                  <p className="text-2xl font-black text-indigo-600 underline decoration-indigo-200 underline-offset-4 decoration-4">
                    {analysis.metrics.avgInterrogations.toFixed(2)}<span className="text-sm font-bold text-gray-400 ml-1">/20</span>
                  </p>
               </div>
               <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm text-center">
                  <p className="text-xs text-gray-500 uppercase font-black tracking-widest mb-1">évaluations</p>
                  <p className="text-2xl font-black text-purple-600 underline decoration-purple-200 underline-offset-4 decoration-4">
                    {analysis.metrics.avgEvaluations.toFixed(2)}<span className="text-sm font-bold text-gray-400 ml-1">/20</span>
                  </p>
               </div>
               <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-indigo-600 dark:border-indigo-500 shadow-sm text-center ring-4 ring-indigo-50 dark:ring-indigo-900/20">
                  <p className="text-xs text-gray-500 uppercase font-black tracking-widest mb-1">Moyenne Générale</p>
                  <p className="text-3xl font-black text-gray-900 dark:text-white">
                    {analysis.metrics.generalAvg.toFixed(2)}<span className="text-sm font-bold text-gray-400 ml-1">/20</span>
                  </p>
               </div>
               <div className="bg-indigo-600 p-4 rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none text-center">
                  <p className="text-xs text-indigo-200 uppercase font-black tracking-widest mb-1 text-white/80">Pourcentage</p>
                  <p className="text-3xl font-black text-white">
                    {analysis.metrics.percentage.toFixed(1)}<span className="text-lg ml-1 opacity-80">%</span>
                  </p>
               </div>
            </div>

            <div className="flex justify-center">
               <div className="px-8 py-3 bg-white dark:bg-gray-800 rounded-full border-2 border-indigo-600 dark:border-indigo-400 flex items-center gap-4">
                  <Award className="text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Mention :</span>
                  <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">
                    {analysis.metrics.mention}
                  </span>
               </div>
            </div>

            <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
               <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <Lightbulb size={24} />
                  </div>
                  <h2 className="text-xl font-bold dark:text-white">Bilan Global</h2>
               </div>
               <p className="text-gray-600 dark:text-gray-300 leading-relaxed italic border-l-4 border-indigo-200 dark:border-indigo-700 pl-4">
                  "{analysis.summary}"
               </p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl p-6 border border-emerald-100 dark:border-emerald-900/30">
                 <h3 className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold mb-4">
                   <CheckCircle2 size={20} />
                   Points Forts
                 </h3>
                 <ul className="space-y-2">
                   {analysis.strengths.map((s, i) => (
                     <li key={i} className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm">
                       <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                       {s}
                     </li>
                   ))}
                 </ul>
              </div>
              <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl p-6 border border-amber-100 dark:border-amber-900/30">
                 <h3 className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold mb-4">
                   <Target size={20} />
                   Axes d'Amélioration
                 </h3>
                 <ul className="space-y-2">
                   {analysis.weaknesses.map((w, i) => (
                     <li key={i} className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
                       <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                       {w}
                     </li>
                   ))}
                 </ul>
              </div>
            </div>

            <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex items-center gap-3">
                <TrendingUp className="text-indigo-600" />
                <h2 className="text-xl font-bold dark:text-white">Recommandations par Matière</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50">
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Matière</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Action Recommandée</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Priorité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {analysis.recommendations.map((rec, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-bold text-gray-900 dark:text-white underline decoration-indigo-200 decoration-4 underline-offset-4">
                            {rec.subject}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600 dark:text-gray-300">{rec.action}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            rec.priority === 'High' ? 'bg-red-100 text-red-600' : 
                            rec.priority === 'Medium' ? 'bg-amber-100 text-amber-600' : 
                            'bg-blue-100 text-blue-600'
                          }`}>
                            {rec.priority}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none">
                  <Calendar size={24} />
                </div>
                <h2 className="text-xl font-bold dark:text-white">Ton Plan de Révision Hebdomadaire</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {analysis.revisionPlan.map((p, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 hover:ring-2 hover:ring-indigo-500 transition-all group animate-fade-in">
                     <h4 className="font-black text-indigo-600 dark:text-indigo-400 mb-3 flex items-center justify-between">
                       {p.day}
                       <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                     </h4>
                     <ul className="space-y-2">
                       {p.tasks.map((task, j) => (
                         <li key={j} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                           <div className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-200"></div>
                           {task}
                         </li>
                       ))}
                     </ul>
                  </div>
                ))}
              </div>
            </section>

            <div className="text-center py-10">
                <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">
                  Ludo AI+ croit en toi ! 🚀
                </p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-100 dark:border-gray-700 text-center space-y-4">
            <BookOpen className="text-gray-300 mx-auto" size={48} />
            <h2 className="text-xl font-bold dark:text-white">Pas encore assez de données</h2>
            <p className="text-gray-500">Continue à travailler dur ! Ludo AI+ aura besoin de quelques notes au cours des 3 derniers mois pour générer une analyse précise.</p>
          </div>
        )}
      </div>
    );
  }

  // RENDER TEACHER & STAFF MODULE (Générateur & Converser AI & Publier à la classe Sélectionnée)
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8 pb-20 font-sans">
      
      {/* Upper Elegant Header Banner */}
      <section className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-2.5 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/25 border border-indigo-500/30 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-200">
              <Sparkles size={12} className="animate-pulse text-indigo-400" />
              Intelligence Pédagogique
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-200">
              Ludo AI+ : Assistant Certifié
            </h1>
            <p className="text-gray-350 text-sm max-w-xl">
              Générez instantanément des leçons, fiches de révision et exercices d'application adaptés aux besoins précis de chaque classe, modifiez-les à volonté par conversation de clavardage, puis publiez-les directement !
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-center gap-1.5 p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
            <BrainCircuit size={40} className="text-purple-400" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Modèles Réseau Sécurisés</span>
          </div>
        </div>
        
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl"></div>
      </section>

      {/* Main Grid: Left Settings Form, Right Interactive Preview and Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: SETUP CARD & CLASS SELECTION */}
        <div className="lg:col-span-4 space-y-6">
          <div id="ai-configuration-card" className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-150 dark:border-gray-700 shadow-sm space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
              <Settings size={18} className="text-indigo-600" />
              <h2 className="text-md font-black text-slate-800 dark:text-gray-100 uppercase tracking-wide">Configuration</h2>
            </div>

            {/* Error alerts */}
            {error && !isGenerating && (
              <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-xl flex gap-2.5 text-xs text-red-700 dark:text-red-300">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Field 1: Target Class (COLUML SELECTION REQUIRED) */}
            <div className="space-y-1.5">
              <label htmlFor="ai-target-class" className="flex items-center gap-1.5 text-xs font-black text-gray-500 uppercase tracking-widest">
                <Users size={14} className="text-indigo-500" />
                SÉLECTIONNER LA CLASSE CIBLE
              </label>
              {classesLoading ? (
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs text-gray-400 animate-pulse">
                  <Loader2 size={14} className="animate-spin text-indigo-500" />
                  <span>Chargement des classes...</span>
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="ai-target-class"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm text-slate-800 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-650 cursor-pointer"
                  >
                    {classesList.length === 0 ? (
                      <option value="">Aucune classe enregistrée</option>
                    ) : (
                      classesList.map((cls) => (
                        <option key={cls.id} value={cls.nom}>
                          👥 Classe : {cls.nom}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>

            {/* Field 2: Subject */}
            <div className="space-y-1.5">
              <label htmlFor="ai-subject" className="text-xs font-black text-gray-500 uppercase tracking-widest block">
                Matière scolaire
              </label>
              {subjectsLoading ? (
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs text-gray-400 animate-pulse">
                  <Loader2 size={14} className="animate-spin text-indigo-500" />
                  <span>Chargement des matières...</span>
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="ai-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm text-slate-800 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-650 cursor-pointer"
                  >
                    <option value="">-- Choisir une matière --</option>
                    {(subjectsList.length > 0 ? subjectsList.map(s => s.name) : SCHOOL_SUBJECTS).map((subj) => (
                      <option key={subj} value={subj}>
                        📚 {subj}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Field 3: Title / Theme of Lesson */}
            <div className="space-y-1.5">
              <label htmlFor="ai-theme" className="text-xs font-black text-gray-500 uppercase tracking-widest block">
                Thème ou Titre de la leçon
              </label>
              <input
                id="ai-theme"
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Ex : fractions équivalentes, l'empire romain"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-semibold text-slate-800 dark:text-gray-100"
              />
            </div>

            {/* Field 4: Content Type Selection */}
            <div className="space-y-2">
              <span className="text-xs font-black text-gray-500 uppercase tracking-widest block">
                Format de Support souhaité
              </span>
              <div className="grid grid-cols-2 gap-2" role="group">
                {[
                  'Leçon / Note de cours',
                  'Série d\'exercices',
                  'Guide de révision',
                  'Devoir de maison',
                  'Fiche pratique'
                ].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setContentType(type)}
                    className={`py-2 px-3 text-left rounded-xl text-xs font-bold border transition-all ${
                      contentType === type
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10'
                        : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Field 5: Steering guidelines / prompt addition */}
            <div className="space-y-1.5">
              <label htmlFor="ai-guidelines" className="text-xs font-black text-gray-500 uppercase tracking-widest block">
                Consignes spécifiques de l'enseignant (Optionnel)
              </label>
              <textarea
                id="ai-guidelines"
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="Ex : Mettre un accent sur des cas pratiques, utiliser un langage simplifié, ajouter des schémas d'explications textuels..."
                rows={3}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium text-slate-800 dark:text-gray-100 resize-none leading-normal"
              />
            </div>

            {/* Submit / Generate Trigger */}
            <button
              onClick={handleGenerateFormation}
              disabled={isGenerating || classesLoading}
              className={`w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                (isGenerating || classesLoading) ? 'opacity-50 cursor-not-allowed bg-indigo-400' : ''
              }`}
            >
              <Sparkles size={16} className={isGenerating ? "animate-spin" : ""} />
              <span>Générer le support pédagogique</span>
            </button>

            {generatedContent && (
              <button
                type="button"
                onClick={handleResetWorkspace}
                className="w-full text-center py-2 text-[11px] font-black uppercase text-gray-400 hover:text-red-500 tracking-wider transition-colors"
              >
                Réinitialiser la session
              </button>
            )}
          </div>
        </div>

        {/* Right Column: LARGE WORKSPACE PREVIEW & CONVERSATIONAL DISCUSSION CHAT */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm overflow-hidden min-h-[600px] flex flex-col justify-between">
            
            {/* Header of Workspace containing Tabs or Empty label */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-150 dark:border-gray-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <h3 className="text-sm font-black text-slate-800 dark:text-gray-200 uppercase tracking-widest">
                  Espace Brouillon - Ludo AI+
                </h3>
              </div>

              {generatedContent && (
                <div className="flex items-center p-0.5 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 gap-1 self-start">
                  <button
                    type="button"
                    onClick={() => setActiveWorkspaceTab('preview')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                      activeWorkspaceTab === 'preview'
                        ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <BookOpen size={13} />
                    Prévisualisation
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveWorkspaceTab('editor')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                      activeWorkspaceTab === 'editor'
                        ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <Edit3 size={13} />
                    Éditeur direct
                  </button>
                </div>
              )}
            </div>

            {/* Card Body - Content visualizer or state loader */}
            <div className="flex-1 p-6 flex flex-col justify-between">
              
              {/* STATE 1: GENERATING LOADING SCREEN */}
              {isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-12 animate-fade-in">
                  <div className="relative w-24 h-24">
                    <div className="absolute inset-0 border-4 border-indigo-100 dark:border-gray-700 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 border-4 border-t-indigo-600 border-r-purple-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="text-indigo-600 animate-bounce" size={28} />
                    </div>
                  </div>
                  <div className="space-y-2 max-w-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Création du support par Ludo AI+...</h3>
                    <p className="text-xs text-gray-500 leading-relaxed font-mono">
                      Adaptation au niveau pédagogique de la classe de {selectedClass}. Analyse des structures de cours, insertion d'illustrations pratiques et d'exercices d'entraînement.
                    </p>
                  </div>
                </div>
              
              // STATE 2: EMPTY STATE (NOT GENERATED YET)
              ) : !generatedContent ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-5 py-16">
                  <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-inner">
                    <BrainCircuit size={32} />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <h3 className="text-md font-extrabold text-slate-700 dark:text-gray-300">Aucune formation en cours</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs mx-auto">
                      Sélectionnez la classe ciblée à gauche, puis définissez votre sujet d'enseignement pour lancer la rédaction assistée.
                    </p>
                  </div>
                </div>

              // STATE 3: PREVIEW DRAFT AREA & CONVERSE CHAT
              ) : (
                <div className="space-y-6 animate-in fade-in duration-500">
                  
                  {/* Top quick-settings for Final deployment name/due date */}
                  <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl space-y-3">
                    <p className="text-[10px] font-black text-indigo-800 dark:text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      Configuration Finale Académique
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Titre final (Sujet visible par élèves)</label>
                        <input
                          type="text"
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-indigo-500 font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Date limite de travail / Échéance</label>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-indigo-500 font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Visual Preview Container Tabs */}
                  {activeWorkspaceTab === 'preview' ? (
                     <div className="border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 rounded-2xl max-h-[420px] overflow-y-auto shadow-inner prose dark:prose-invert max-w-none text-slate-800 dark:text-gray-100 italic-quotes leading-relaxed text-sm">
                       <Markdown>{generatedContent}</Markdown>
                     </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-wide block">Contenu Brut (Modifiable manuellement)</label>
                      <textarea
                        value={generatedContent}
                        onChange={(e) => setGeneratedContent(e.target.value)}
                        rows={16}
                        className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs font-mono leading-relaxed text-slate-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  )}

                  {/* INTERACTIVE CHAT COMPANION (Converser avec l'IA) */}
                  <div className="border-t border-gray-100 dark:border-gray-700 pt-5 space-y-4">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare size={16} className="text-indigo-600 animate-pulse" />
                      <h4 className="text-xs font-black text-slate-800 dark:text-gray-300 uppercase tracking-wider">
                        Converser avec Ludo AI+ pour corriger / enrichir
                      </h4>
                    </div>

                    {/* Chat Bubble List */}
                    <div className="space-y-2.5 max-h-[160px] overflow-y-auto p-3 bg-gray-50 dark:bg-gray-950/30 rounded-xl border border-gray-100 dark:border-gray-900/50">
                      {chatMessages.length === 0 && (
                        <p className="text-[11px] text-gray-400 italic text-center py-2">
                          Aucun ajustement conversationnel initié. Écrivez un message ci-dessous pour repolir ce contenu.
                        </p>
                      )}
                      
                      {chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex flex-col space-y-0.5 max-w-[85%] ${
                            msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                          }`}
                        >
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
                            {msg.role === 'user' ? 'Vous' : 'Ludo AI+'}
                          </span>
                          <div
                            className={`p-3 rounded-2xl text-xs leading-normal ${
                              msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-tr-none shadow-md'
                                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-800 dark:text-gray-100 rounded-tl-none shadow-sm'
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      ))}

                      {isApplyingChange && (
                        <div className="flex items-center gap-2 mr-auto bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 px-3.5 py-2.5 rounded-2xl rounded-tl-none text-xs text-indigo-600">
                          <Loader2 size={13} className="animate-spin" />
                          <span className="font-semibold animate-pulse">Ludo AI+ révise le brouillon...</span>
                        </div>
                      )}
                    </div>

                    {/* Chat Input form */}
                    <form onSubmit={handleSendChatMessage} className="flex gap-2.5">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Demander un ajustement... (ex: 'Rends-le plus court', 'Ajoute un exercice à la fin')"
                        disabled={isApplyingChange || isGenerating}
                        className="flex-1 px-4 py-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 dark:text-gray-100"
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || isApplyingChange || isGenerating}
                        className={`px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center transition-all ${
                          (!chatInput.trim() || isApplyingChange || isGenerating) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        <Send size={14} />
                      </button>
                    </form>
                  </div>

                  {/* PUBLISH TO CLASS ACTIONS */}
                  <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="text-left">
                      <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">
                        Publication Cible
                      </p>
                      <p className="text-xs text-slate-800 dark:text-gray-200 font-black">
                        🏫 Devoirs & Support Pédagogique de la classe : <span className="text-indigo-600 underline font-mono">{selectedClass}</span>
                      </p>
                    </div>

                    <button
                      onClick={handlePublishToClass}
                      disabled={isPublishing || isGenerating}
                      className={`px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 ${
                        isPublishing ? 'opacity-50 cursor-not-allowed bg-emerald-400' : ''
                      }`}
                    >
                      {isPublishing ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Publication en cours...</span>
                        </>
                      ) : (
                        <>
                          <BookOpenCheck size={14} className="stroke-[2.5]" />
                          <span>🚀 Publier dans la classe {selectedClass}</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>
              )}

            </div>

          </div>
        </div>

      </div>

      {/* Success publication Dialog modal */}
      <SuccessModal 
        isOpen={publishSuccess}
        onClose={() => {
          setPublishSuccess(false);
          handleResetWorkspace();
        }}
        title="Formation Publiée !"
        message={`Votre support "${draftTitle}" de la matière ${subject} a bien été publié dans la classe de ${selectedClass}. Tous les élèves y ont désormais immédiatement accès dans leur espace "Devoirs & Leçons" !`}
      />

    </div>
  );
};

export default LudoAIPlus;
