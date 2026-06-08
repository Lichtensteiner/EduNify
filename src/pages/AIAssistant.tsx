import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Sparkles, Upload, Send, CheckCircle, AlertCircle, Loader2, Image as ImageIcon, FileText, X, BookOpen, ListChecks, HelpCircle, FileSearch, Copy, Terminal, Trash2, ChevronRight, Search } from 'lucide-react';
import { createNotification } from '../services/NotificationService';
import { collection, query, getDocs, where, addDoc, serverTimestamp, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { generateAIContent } from '../services/aiService';
import { SCHOOL_CLASSES, SCHOOL_SUBJECTS } from '../constants';

interface AIAssistantProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export default function AIAssistant({ onNavigate }: AIAssistantProps) {
  const { t, language } = useLanguage();
  const { currentUser } = useAuth();
  const { notifySuccess, notifyError, notifyUpdate, notifyAdd } = useNotification();
  const [activeTab, setActiveTab] = useState<'grading' | 'preparations' | 'prompts' | 'my_preps'>('grading');

  // Grading State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [suggestedScore, setSuggestedScore] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Preparations State
  const [prepTopic, setPrepTopic] = useState('');
  const [prepGrade, setPrepGrade] = useState('');
  const [prepSubject, setPrepSubject] = useState('');
  const [subjects, setSubjects] = useState<{id: string, name: string}[]>([]);
  const [classesList, setClassesList] = useState<{ id: string, name: string }[]>([]);
  const [classesLoading, setClassesLoading] = useState<boolean>(true);
  const [prepType, setPrepType] = useState('lesson_plan');
  const [isGeneratingPrep, setIsGeneratingPrep] = useState(false);
  const [generatedPrep, setGeneratedPrep] = useState<string | null>(null);
  const [isSavingPrep, setIsSavingPrep] = useState(false);

  // Saved Preparations State
  const [savedPreps, setSavedPreps] = useState<any[]>([]);
  const [selectedPrep, setSelectedPrep] = useState<any | null>(null);
  const [prepSearchQuery, setPrepSearchQuery] = useState('');

  // Prompts State
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  const promptTemplates = [
    {
      id: 'p1',
      title: t('lesson_plan'),
      description: t('ai_lesson_plan_desc_short'),
      prompt: t('ai_lesson_plan_prompt')
    },
    {
      id: 'p2',
      title: t('exercises_generator'),
      description: t('ai_exercises_desc_short'),
      prompt: t('ai_exercises_prompt')
    },
    {
      id: 'p3',
      title: t('concept_simplification'),
      description: t('ai_concept_desc_short'),
      prompt: t('ai_concept_prompt')
    },
    {
      id: 'p4',
      title: t('quiz_generator'),
      description: t('ai_quiz_desc_short'),
      prompt: t('ai_quiz_prompt')
    }
  ];

  // Fetch students for the dropdown
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'élève'));
        const snap = await getDocs(q);
        setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching students:", error);
      }
    };
    fetchStudents();
  }, []);

  // Fetch Subjects
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'subjects'), (snap) => {
      if (!snap.empty) {
        const subjectsData = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));
        setSubjects(subjectsData.sort((a, b) => a.name.localeCompare(b.name)));
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Classes
  useEffect(() => {
    setClassesLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'classes'), (snap) => {
      const classesData = snap.docs.map(doc => ({ id: doc.id, name: (doc.data().nom || '') as string }));
      setClassesList(classesData.sort((a, b) => a.name.localeCompare(b.name)));
      setClassesLoading(false);
    }, (err) => {
      console.error("Error loading classes for AI Assistant:", err);
      setClassesLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time listener for saved preparations
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'preparations'),
      where('authorId', '==', currentUser.id)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const preps = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client-side to avoid requiring a composite index
      preps.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setSavedPreps(preps);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const analyzeWork = async () => {
    if (!selectedFile || !previewUrl) return;
    setIsAnalyzing(true);
    setAiFeedback(null);
    setSuggestedScore(null);

    try {
      const base64Data = previewUrl.split(',')[1];

      const prompt = `
        You are an expert pedagogical assistant. Analyze this student work (image).
        1. Identify the subject of the work.
        2. List strengths.
        3. List points to improve.
        4. Suggest a score out of 20 (format X/20).
        5. Write a short personalized encouragement message for the student.
        Respond in ${language === 'fr' ? 'French' : language === 'es' ? 'Spanish' : language === 'zh' ? 'Chinese' : language === 'ja' ? 'Japanese' : 'English'} in a structured way with clear titles.
      `;

      const response = await generateAIContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType: selectedFile.type } }
          ]
        }
      });

      const result = response.text;
      
      if (!result) throw new Error(t('ai_empty_response'));
      
      setAiFeedback(result);
      
      const scoreMatch = result.match(/(\d{1,2})\/20/);
      if (scoreMatch) setSuggestedScore(scoreMatch[0]);

    } catch (error: any) {
      console.error("AI Analysis error:", error);
      notifyError(`${t('ai_analysis_error')} : ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generatePreparation = async () => {
    if (!prepTopic || !prepGrade || !prepSubject) return;
    setIsGeneratingPrep(true);
    setGeneratedPrep(null);

    try {
      let typeLabel = "";
      switch(prepType) {
        case 'lesson_plan': typeLabel = "un plan de cours détaillé"; break;
        case 'exercises_list': typeLabel = "une liste d'exercices variés"; break;
        case 'quiz_mcq': typeLabel = "un quiz / QCM avec corrigé"; break;
        case 'summary_sheet': typeLabel = "une fiche de synthèse pour les élèves"; break;
      }

      const prompt = `
        You are an expert pedagogical assistant in ${prepSubject}. Generate ${typeLabel} for the following subject: "${prepTopic}".
        Grade level: ${prepGrade}.
        The response must be structured, professional and ready to use for a teacher.
        Respond in ${language === 'fr' ? 'French' : language === 'es' ? 'Spanish' : language === 'zh' ? 'Chinese' : language === 'ja' ? 'Japanese' : 'English'}.
      `;

      const response = await generateAIContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [{ text: prompt }] }
      });

      if (!response.text) throw new Error(t('ai_empty_response'));
      setGeneratedPrep(response.text);
    } catch (error: any) {
      console.error("AI Generation error:", error);
      notifyError(`${t('ai_generation_error')} : ${error.message}`);
    } finally {
      setIsGeneratingPrep(false);
    }
  };

  const savePreparation = async () => {
    if (!generatedPrep || !currentUser) return;
    setIsSavingPrep(true);
    try {
      await addDoc(collection(db, 'preparations'), {
        authorId: currentUser.id,
        authorName: `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim(),
        topic: prepTopic,
        grade: prepGrade,
        subject: prepSubject,
        type: prepType,
        content: generatedPrep,
        createdAt: serverTimestamp()
      });
      notifyAdd(t('prep_saved_success'));
      setGeneratedPrep(null);
      setPrepTopic('');
      setPrepGrade('');
      setPrepSubject('');
    } catch (error) {
      console.error("Error saving preparation:", error);
      notifyError(t('save_error'));
    } finally {
      setIsSavingPrep(false);
    }
  };

  const sendFeedback = async () => {
    if (!selectedStudentId || !aiFeedback) return;
    setIsSending(true);
    try {
      await createNotification({
        user_id: selectedStudentId,
        title: t('new_ai_feedback'),
        message: t('ai_feedback_shared_msg').replace('{{score}}', suggestedScore || 'N/A'),
        content: aiFeedback,
        type: 'success',
        targetTab: 'student_dashboard'
      });
      notifySuccess(t('feedback_sent_success'));
      setAiFeedback(null);
      setSuggestedScore(null);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error("Error sending feedback:", error);
      notifyError(t('feedback_send_error'));
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const deletePrep = async (id: string) => {
    if (!confirm(t('delete_prep_confirm'))) return;
    try {
      await deleteDoc(doc(db, 'preparations', id));
      if (selectedPrep?.id === id) setSelectedPrep(null);
    } catch (error) {
      console.error("Error deleting preparation:", error);
    }
  };

  // Group preparations by subject
  const groupedPreps = savedPreps.reduce((acc: any, prep) => {
    const subject = prep.subject || t('other');
    if (!acc[subject]) acc[subject] = [];
    acc[subject].push(prep);
    return acc;
  }, {});

  const filteredSubjects = Object.keys(groupedPreps).filter(subject => 
    subject.toLowerCase().includes(prepSearchQuery.toLowerCase()) ||
    groupedPreps[subject].some((p: any) => p.topic.toLowerCase().includes(prepSearchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl">
            <Sparkles className="text-indigo-600 dark:text-indigo-400" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ai_assistant')}</h1>
            <p className="text-gray-500 dark:text-gray-400">{t('ai_gemini_boost')}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl overflow-x-auto">
          {[
            { id: 'grading', label: t('ai_grading_tab') },
            { id: 'preparations', label: t('ai_preps_tab') },
            { id: 'my_preps', label: t('my_preps_tab') },
            { id: 'prompts', label: t('ai_prompts_tab') },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'grading' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
          {/* Upload Section */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Upload size={20} className="text-indigo-600" />
                  {t('upload_work')}
                </h2>
                {previewUrl && (
                  <button onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="text-gray-400 hover:text-red-500">
                    <X size={20} />
                  </button>
                )}
              </div>
              
              <label className="block w-full aspect-video border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors cursor-pointer overflow-hidden relative group">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                    <ImageIcon size={48} className="mb-2" />
                    <span className="text-sm">{t('click_to_select_photo')}</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              </label>

              <button
                onClick={analyzeWork}
                disabled={!selectedFile || isAnalyzing}
                className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    {t('analyzing')}
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    {t('analyze_with_gemini')}
                  </>
                )}
              </button>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
              <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center gap-2">
                <AlertCircle size={16} />
                {t('ai_usage_tip')}
              </h3>
              <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed">
                {t('ai_usage_tip_desc')}
              </p>
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {aiFeedback ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <CheckCircle size={20} className="text-green-500" />
                    {t('ai_feedback')}
                  </h2>
                  {suggestedScore && (
                    <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-bold">
                      {t('ai_score')}: {suggestedScore}
                    </div>
                  )}
                </div>
                
                <div className="prose dark:prose-invert max-w-none text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap mb-6 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {aiFeedback}
                </div>

                <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('select_student_recipient')}
                    </label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">{t('choose_student')}</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.prenom} {s.nom} ({s.classe || 'N/A'})</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={sendFeedback}
                    disabled={!selectedStudentId || isSending}
                    className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                  >
                    {isSending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                    {t('send_to_student')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8">
                <div className="p-6 bg-white dark:bg-gray-800 rounded-full shadow-sm mb-4">
                  <FileText size={48} className="opacity-20" />
                </div>
                <p className="text-center max-w-xs">{t('ai_results_placeholder')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'preparations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
          {/* Config Section */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <BookOpen size={20} className="text-indigo-600" />
                {t('configuration')}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('subject')}</label>
                  <select
                    value={prepSubject}
                    onChange={(e) => setPrepSubject(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none hover:border-gray-300 dark:hover:border-gray-650 cursor-pointer text-slate-800 dark:text-gray-100 font-bold transition-all shadow-sm"
                  >
                    <option value="">📚 {t('subject_placeholder')}</option>
                    {(subjects.length > 0 ? subjects.map(s => s.name) : SCHOOL_SUBJECTS).map(subj => (
                      <option key={subj} value={subj}>📚 {subj}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('topic_subject')}</label>
                  <input
                    type="text"
                    value={prepTopic}
                    onChange={(e) => setPrepTopic(e.target.value)}
                    placeholder="Ex: Les fractions, La Révolution Française..."
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('grade_level')}</label>
                  {classesLoading ? (
                    <div className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-400 animate-pulse">
                      <Loader2 size={14} className="animate-spin text-indigo-500" />
                      <span>{language === 'fr' ? 'Chargement des classes...' : 'Loading classes...'}</span>
                    </div>
                  ) : (
                    <select
                      value={prepGrade}
                      onChange={(e) => setPrepGrade(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer text-slate-800 dark:text-gray-100 font-medium"
                    >
                      <option value="">{t('choose_class')}</option>
                      {(classesList.length > 0 ? classesList.map(c => c.name) : SCHOOL_CLASSES).map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('preparation_type')}</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'lesson_plan', label: t('lesson_plan'), icon: BookOpen },
                      { id: 'exercises_list', label: t('exercises_list'), icon: ListChecks },
                      { id: 'quiz_mcq', label: t('quiz_mcq'), icon: HelpCircle },
                      { id: 'summary_sheet', label: t('summary_sheet'), icon: FileSearch },
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setPrepType(type.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          prepType === type.id
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                            : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <type.icon size={18} />
                        <span className="text-sm font-medium">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={generatePreparation}
                  disabled={!prepTopic || !prepGrade || !prepSubject || isGeneratingPrep}
                  className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isGeneratingPrep ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      {t('generating')}
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      {t('generate_preparation')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="lg:col-span-2 space-y-6">
            {generatedPrep ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 animate-fade-in flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <CheckCircle size={20} className="text-green-500" />
                    {t('prep_preview')}
                  </h2>
                  <button
                    onClick={savePreparation}
                    disabled={isSavingPrep}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-all"
                  >
                    {isSavingPrep ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    {t('save_preparation')}
                  </button>
                </div>
                
                <div className="flex-1 prose dark:prose-invert max-w-none text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 overflow-y-auto custom-scrollbar">
                  {generatedPrep}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8">
                <div className="p-6 bg-white dark:bg-gray-800 rounded-full shadow-sm mb-4">
                  <BookOpen size={48} className="opacity-20" />
                </div>
                <p className="text-center max-w-xs">{t('prep_config_placeholder')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'my_preps' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
          {/* List Section */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-[calc(100vh-250px)]">
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={prepSearchQuery}
                  onChange={(e) => setPrepSearchQuery(e.target.value)}
                  placeholder={t('search_prep_placeholder')}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                {filteredSubjects.length > 0 ? (
                  filteredSubjects.map(subject => (
                    <div key={subject}>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">{subject}</h3>
                      <div className="space-y-2">
                        {groupedPreps[subject]
                          .filter((p: any) => p.topic.toLowerCase().includes(prepSearchQuery.toLowerCase()) || subject.toLowerCase().includes(prepSearchQuery.toLowerCase()))
                          .map((prep: any) => (
                          <button
                            key={prep.id}
                            onClick={() => {
                              setSelectedPrep(prep);
                              if (onNavigate) {
                                onNavigate('courses_subjects', { prepId: prep.id });
                              }
                            }}
                            className={`w-full text-left p-3 rounded-xl border transition-all group ${
                              selectedPrep?.id === prep.id
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800'
                                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className={`text-sm font-bold ${selectedPrep?.id === prep.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>
                                  {prep.topic}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {prep.grade} • {t(prep.type)}
                                </p>
                              </div>
                              <ChevronRight size={16} className={`transition-transform ${selectedPrep?.id === prep.id ? 'translate-x-1 text-indigo-500' : 'text-gray-300 group-hover:text-gray-400'}`} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <FileSearch size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-sm text-gray-500">{t('no_preps_found')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detail Section */}
          <div className="lg:col-span-2">
            {selectedPrep ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-200 dark:border-gray-700 animate-fade-in flex flex-col h-[calc(100vh-250px)]">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded uppercase tracking-wider">
                        {selectedPrep.subject}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-[10px] font-bold rounded uppercase tracking-wider">
                        {selectedPrep.grade}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedPrep.topic}</h2>
                    <p className="text-sm text-gray-500 mt-1">{t('generated_on')} {new Date(selectedPrep.createdAt?.toDate()).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => deletePrep(selectedPrep.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                    title={t('delete_prep')}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="flex-1 prose dark:prose-invert max-w-none text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/50 p-8 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-y-auto custom-scrollbar shadow-inner">
                  {selectedPrep.content}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8">
                <div className="p-6 bg-white dark:bg-gray-800 rounded-full shadow-sm mb-4">
                  <FileText size={48} className="opacity-20" />
                </div>
                <p className="text-center max-w-xs">{t('select_prep_desc')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'prompts' && (
        <div className="animate-fade-in space-y-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl">
                <Terminal className="text-indigo-600 dark:text-indigo-400" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('ai_prompts_title')}</h2>
                <p className="text-gray-500 dark:text-gray-400">{t('ai_prompts_desc')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {promptTemplates.map((template) => (
                <div key={template.id} className="group bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white mb-1">{template.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{template.description}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(template.prompt, template.id)}
                      className={`p-2 rounded-xl transition-all ${
                        copiedPromptId === template.id 
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-white dark:bg-gray-800 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm'
                      }`}
                    >
                      {copiedPromptId === template.id ? <CheckCircle size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 text-xs font-mono text-gray-600 dark:text-gray-400 leading-relaxed italic">
                    "{template.prompt}"
                  </div>
                  {copiedPromptId === template.id && (
                    <p className="text-[10px] text-green-600 dark:text-green-400 mt-2 font-medium animate-pulse">
                      {t('prompt_copied')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-100 dark:border-amber-800 flex gap-4">
            <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-xl h-fit">
              <AlertCircle className="text-amber-600 dark:text-amber-400" size={20} />
            </div>
            <div>
              <h4 className="font-bold text-amber-800 dark:text-amber-300 mb-1">{t('how_to_use_prompts')}</h4>
              <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                {t('how_to_use_prompts_desc')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
