import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { generateAIContent } from '../services/aiService';
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
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

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

const LudoAIPlus: React.FC = () => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.role === 'élève') {
      fetchGrades();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  const fetchGrades = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // Fetch grades for the student from the last 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const q = query(
        collection(db, 'grades'),
        where('studentId', '==', currentUser.id)
      );
      
      const snap = await getDocs(q);
      let gradesData = snap.docs.map(doc => doc.data() as Grade);
      
      // Filter by date client-side to avoid needing a composite index
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
        model: "gemini-3-flash-preview",
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

  if (currentUser?.role !== 'élève') {
    return (
      <div className="p-8 text-center max-w-2xl mx-auto space-y-4">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-600">
            <Sparkles size={32} />
        </div>
        <h2 className="text-2xl font-bold dark:text-white">Ludo AI+ : Tutorat Personnalisé</h2>
        <p className="text-gray-500">Cette fonctionnalité est réservée aux élèves pour analyser leurs performances et recevoir des conseils de révision personnalisés.</p>
      </div>
    );
  }

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
        
        {/* Background elements */}
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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Key Metrics Section */}
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

          {/* Summary Card */}
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

          {/* Strengths & Weaknesses */}
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

          {/* Recommendations Table */}
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

          {/* Revision Plan */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none">
                <Calendar size={24} />
              </div>
              <h2 className="text-xl font-bold dark:text-white">Ton Plan de Révision Hebdomadaire</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {analysis.revisionPlan.map((p, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 hover:ring-2 hover:ring-indigo-500 transition-all group">
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

          {/* Motivational Quote */}
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
};

export default LudoAIPlus;
