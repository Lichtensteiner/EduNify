import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { 
  BookOpen, 
  GraduationCap, 
  ChevronRight, 
  FileText, 
  Search, 
  Filter, 
  Sparkles, 
  Clock, 
  User, 
  X, 
  Send, 
  Trash2, 
  Edit, 
  Plus, 
  Paperclip, 
  Download, 
  RefreshCw 
} from 'lucide-react';
import { SCHOOL_CLASSES, SCHOOL_SUBJECTS } from '../constants';

interface CoursesSubjectsProps {
  initialPrepId?: string;
}

export default function CoursesSubjects({ initialPrepId }: CoursesSubjectsProps) {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [preparations, setPreparations] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<{id: string, name: string}[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [editingSubject, setEditingSubject] = useState<{id: string, name: string} | null>(null);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedPrep, setSelectedPrep] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [activeTab, setActiveTab] = useState<'courses' | 'subjects'>('courses');
  
  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newCourse, setNewCourse] = useState({
    topic: '',
    subject: '',
    grade: '',
    content: '',
    type: 'course'
  });

  useEffect(() => {
    if (initialPrepId && preparations.length > 0) {
      const prep = preparations.find(p => p.id === initialPrepId);
      if (prep) {
        setSelectedPrep(prep);
      }
    }
  }, [initialPrepId, preparations]);

  useEffect(() => {
    if (!currentUser) return;

    // Fetch classes
    let classesQuery;
    if (currentUser.role === 'admin') {
      classesQuery = query(collection(db, 'classes'));
    } else {
      classesQuery = query(
        collection(db, 'classes'),
        where('enseignants_ids', 'array-contains', currentUser.id)
      );
    }

    const unsubscribeClasses = onSnapshot(classesQuery, (snap) => {
      const classesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClasses(classesData);
    });

    // Fetch preparations (Courses)
    let prepsQuery;
    if (currentUser.role === 'admin') {
      prepsQuery = query(collection(db, 'preparations'));
    } else {
      prepsQuery = query(
        collection(db, 'preparations'),
        where('authorId', '==', currentUser.id)
      );
    }

    const unsubscribePreps = onSnapshot(prepsQuery, (snap) => {
      const preps = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      preps.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setPreparations(preps);
      setLoading(false);
    });

    // Fetch Subjects
    const unsubscribeSubjects = onSnapshot(collection(db, 'subjects'), (snap) => {
      if (snap.empty) {
        // Initial population
        SCHOOL_SUBJECTS.forEach(async (subj) => {
          await addDoc(collection(db, 'subjects'), { name: subj, createdAt: serverTimestamp() });
        });
      } else {
        const subjectsData = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));
        setSubjects(subjectsData.sort((a, b) => a.name.localeCompare(b.name)));
      }
    });

    return () => {
      unsubscribeClasses();
      unsubscribePreps();
      unsubscribeSubjects();
    };
  }, [currentUser]);

  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) return;
    setIsAddingSubject(true);
    try {
      await addDoc(collection(db, 'subjects'), {
        name: newSubjectName.trim(),
        createdAt: serverTimestamp()
      });
      setNewSubjectName('');
    } catch (error) {
      console.error("Error adding subject:", error);
      alert("Erreur lors de l'ajout de la matière");
    } finally {
      setIsAddingSubject(false);
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette matière ?')) {
      try {
        await deleteDoc(doc(db, 'subjects', subjectId));
      } catch (error) {
        console.error("Error deleting subject:", error);
        alert("Erreur lors de la suppression");
      }
    }
  };

  const handleUpdateSubjectName = async () => {
    if (!editingSubject || !editingSubject.name.trim()) return;
    try {
      await updateDoc(doc(db, 'subjects', editingSubject.id), {
        name: editingSubject.name.trim()
      });
      setEditingSubject(null);
    } catch (error) {
      console.error("Error updating subject:", error);
      alert("Erreur lors de la mise à jour");
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!newCourse.topic || !newCourse.subject || !newCourse.grade) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    try {
      let fileData = {};
      if (selectedFile) {
        const fileRef = ref(storage, `courses/${Date.now()}_${selectedFile.name}`);
        
        // Optimization: Use uploadBytes for files < 5MB
        if (selectedFile.size < 5 * 1024 * 1024) {
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => (prev !== null && prev < 90) ? prev + 15 : prev);
          }, 400);

          try {
            await uploadBytes(fileRef, selectedFile);
            clearInterval(progressInterval);
            setUploadProgress(95);
            const url = await getDownloadURL(fileRef);
            fileData = { fileUrl: url, fileName: selectedFile.name };
          } catch (error) {
            clearInterval(progressInterval);
            throw error;
          }
        } else {
          const { uploadBytesResumable } = await import('firebase/storage');
          const uploadTask = uploadBytesResumable(fileRef, selectedFile);
          
          const url = await new Promise<string>((resolve, reject) => {
            uploadTask.on('state_changed',
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 90;
                setUploadProgress(10 + progress);
              },
              (error) => reject(error),
              async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
              }
            );
          });

          fileData = { fileUrl: url, fileName: selectedFile.name };
        }
      }

      setUploadProgress(95);

      await addDoc(collection(db, 'preparations'), {
        ...newCourse,
        ...fileData,
        authorId: currentUser.id,
        authorName: `${currentUser.prenom} ${currentUser.nom}`,
        createdAt: serverTimestamp(),
      });

      setUploadProgress(100);

      setTimeout(() => {
        setShowAddModal(false);
        setNewCourse({ topic: '', subject: '', grade: '', content: '', type: 'course' });
        setSelectedFile(null);
        setUploadProgress(null);
        setUploading(false);
      }, 500);
    } catch (error) {
      console.error("Error adding course:", error);
      alert("Erreur lors de l'ajout du cours.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const filteredPreps = preparations.filter(prep => {
    const matchesSearch = prep.topic?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         prep.subject?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClassId === 'all' || prep.grade === selectedClassId;
    return matchesSearch && matchesClass;
  });

  const groupedPreps = filteredPreps.reduce((acc: any, prep) => {
    const subject = prep.subject || 'Autre';
    if (!acc[subject]) acc[subject] = [];
    acc[subject].push(prep);
    return acc;
  }, {});

  const handleDeletePrep = async (e: React.MouseEvent, prepId: string) => {
    e.stopPropagation();
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce cours ?')) {
      try {
        await deleteDoc(doc(db, 'preparations', prepId));
        if (selectedPrep?.id === prepId) setSelectedPrep(null);
      } catch (error) {
        console.error("Error deleting preparation:", error);
        alert("Erreur lors de la suppression");
      }
    }
  };

  const handleStartEdit = () => {
    if (selectedPrep) {
      setEditContent(selectedPrep.content);
      setEditTopic(selectedPrep.topic);
      setIsEditing(true);
    }
  };

  const handleUpdatePrep = async () => {
    if (!selectedPrep) return;
    try {
      await updateDoc(doc(db, 'preparations', selectedPrep.id), {
        content: editContent,
        topic: editTopic
      });
      setSelectedPrep({ ...selectedPrep, content: editContent, topic: editTopic });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating preparation:", error);
      alert("Erreur lors de la mise à jour");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <BookOpen className="text-indigo-600" size={28} />
            {t('courses_subjects')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {currentUser?.role === 'admin' 
              ? 'Supervision de tous les contenus pédagogiques de l\'établissement'
              : 'Gérez vos contenus pédagogiques et préparations IA par classe'}
          </p>
        </div>
        {(currentUser?.role === 'admin' || currentUser?.role === 'enseignant') && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus size={20} />
            Ajouter un cours
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'courses'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Cours & Préparations
        </button>
        <button
          onClick={() => setActiveTab('subjects')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'subjects'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Matières par Classe
        </button>
      </div>

      {activeTab === 'courses' ? (
        <>
          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un cours, un sujet..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-400" />
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="all">Toutes les classes / niveaux</option>
                {Array.from(new Set(preparations.map(p => p.grade))).filter(Boolean).map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Content */}
          {Object.keys(groupedPreps).length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Aucun cours trouvé</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                {currentUser?.role === 'admin' 
                  ? 'Aucune préparation n\'a été générée par les enseignants pour le moment.'
                  : 'Vous n\'avez pas encore de préparations enregistrées. Utilisez l\'Assistant IA pour générer vos premiers cours.'}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.keys(groupedPreps).map(subject => (
                <div key={subject} className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className="w-2 h-6 bg-indigo-600 rounded-full"></div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wider">{subject}</h2>
                    <span className="text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                      {groupedPreps[subject].length} cours
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groupedPreps[subject].map((prep: any) => (
                      <div 
                        key={prep.id}
                        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all overflow-hidden group"
                      >
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
                              <Sparkles size={24} />
                            </div>
                            <div className="flex items-center gap-2">
                              {(currentUser?.role === 'admin' || prep.authorId === currentUser?.id) && (
                                <>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPrep(prep);
                                      setEditContent(prep.content);
                                      setEditTopic(prep.topic);
                                      setIsEditing(true);
                                    }}
                                    className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button 
                                    onClick={(e) => handleDeletePrep(e, prep.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                              <div className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-[10px] font-bold rounded uppercase tracking-wider">
                                {t(prep.type)}
                              </div>
                            </div>
                          </div>

                          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 line-clamp-1">{prep.topic}</h3>
                          <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 font-semibold mb-4">
                            <GraduationCap size={14} />
                            <span>{prep.grade}</span>
                          </div>

                          <div className="space-y-2 mb-6">
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <Clock size={14} />
                              <span>Généré le {new Date(prep.createdAt?.toDate()).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <User size={14} />
                              <span>Par {prep.authorName}</span>
                            </div>
                          </div>

                          <div className="prose dark:prose-invert max-w-none text-xs text-gray-600 dark:text-gray-300 line-clamp-3 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700 italic mb-4">
                            {prep.content || (prep.fileUrl ? "Consultez le document joint pour le contenu du cours." : "Aucun contenu pré-rédigé.")}
                          </div>

                          {prep.fileUrl && (
                            <div className="mb-4">
                              <a 
                                href={prep.fileUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-bold hover:bg-indigo-100 transition-colors w-full"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Paperclip size={14} />
                                <span className="truncate flex-1">{prep.fileName || "Document joint"}</span>
                                <Download size={14} />
                              </a>
                            </div>
                          )}
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                          <button 
                            onClick={() => setSelectedPrep(prep)}
                            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Détails du cours
                          </button>
                          <ChevronRight size={14} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Global Subjects Repertoire */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="text-indigo-600" size={24} />
                  Répertoire des Matières
                </h3>
                <p className="text-xs text-gray-500 mt-1">Liste exhaustive de toutes les disciplines enseignées dans l'établissement</p>
              </div>
              
              {currentUser?.role === 'admin' && (
                <div className="flex gap-2 w-full md:w-auto">
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="Nouvelle matière..."
                    className="flex-1 md:w-64 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                  <button
                    onClick={handleAddSubject}
                    disabled={isAddingSubject || !newSubjectName.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 flex items-center gap-2 whitespace-nowrap text-sm"
                  >
                    <Plus size={18} />
                    {isAddingSubject ? '...' : 'Ajouter'}
                  </button>
                </div>
              )}
            </div>

            {subjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {subjects.map((subj) => (
                  <div 
                    key={subj.id} 
                    className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-xl border border-gray-100 dark:border-gray-700 group hover:border-indigo-200 dark:hover:border-indigo-900 transition-all hover:bg-white dark:hover:bg-gray-800"
                  >
                    {editingSubject?.id === subj.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          type="text"
                          value={editingSubject.name}
                          onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                          className="bg-white dark:bg-gray-800 border border-indigo-500 rounded px-2 py-0.5 outline-none w-32"
                          onKeyDown={(e) => e.key === 'Enter' && handleUpdateSubjectName()}
                          onBlur={() => setEditingSubject(null)}
                        />
                      </div>
                    ) : (
                      <span>{subj.name}</span>
                    )}
                    
                    {currentUser?.role === 'admin' && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 border-l border-gray-200 dark:border-gray-700 pl-2">
                        <button 
                          onClick={() => setEditingSubject(subj)}
                          className="p-1 hover:text-indigo-600 transition-colors"
                          title="Modifier"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteSubject(subj.id)}
                          className="p-1 hover:text-red-500 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                <RefreshCw size={24} className="mx-auto text-gray-300 animate-spin mb-2" />
                <p className="text-sm text-gray-500 italic">Chargement du répertoire...</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <div className="w-2 h-6 bg-amber-500 rounded-full"></div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wider">Répartition par Classe</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map(cls => (
                <div key={cls.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                  <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">{cls.nom}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-tighter">{cls.niveau}</p>
                    </div>
                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600">
                      <GraduationCap size={20} />
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Matières Active</h4>
                      <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900 text-indigo-600 px-2 py-0.5 rounded-full">
                        {cls.matieres?.length || 0}
                      </span>
                    </div>
                    {cls.matieres && cls.matieres.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {cls.matieres.sort().map((m: string, idx: number) => (
                          <span key={idx} className="px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            {m}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="py-4 text-center bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-400 italic">Aucune matière définie</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {classes.length === 0 && (
            <div className="col-span-full bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
              <RefreshCw size={32} className="mx-auto text-gray-300 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-medium tracking-tight">Récupération des données en temps réel...</p>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedPrep && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
              <div className="flex-1 mr-4">
                {isEditing ? (
                  <input
                    type="text"
                    value={editTopic}
                    onChange={(e) => setEditTopic(e.target.value)}
                    className="w-full px-3 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-lg font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedPrep.topic}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedPrep.subject} • {selectedPrep.grade}</p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <button 
                    onClick={handleStartEdit}
                    className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Modifier"
                  >
                    <Edit size={20} />
                  </button>
                )}
                <button 
                  onClick={() => {
                    setSelectedPrep(null);
                    setIsEditing(false);
                  }} 
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-full min-h-[400px] p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none custom-scrollbar"
                />
              ) : (
                <div className="space-y-6">
                  {selectedPrep.fileUrl && (
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-50 dark:border-gray-700">
                          <Paperclip size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedPrep.fileName || "Document de cours"}</p>
                          <p className="text-xs text-gray-500">Document PDF ou Image</p>
                        </div>
                      </div>
                      <a 
                        href={selectedPrep.fileUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                      >
                        <Download size={14} />
                        Télécharger
                      </a>
                    </div>
                  )}
                  <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                    {selectedPrep.content || (!selectedPrep.fileUrl && "Aucun contenu disponible pour ce cours.")}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-medium rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleUpdatePrep}
                    className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
                  >
                    Enregistrer les modifications
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setSelectedPrep(null)}
                    className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-medium rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    {t('close')}
                  </button>
                  <button
                    className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    <Send size={18} />
                    {t('publish_to_class')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Course Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="text-indigo-600" size={24} />
                Nouveau cours
              </h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateCourse} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Matière</label>
                  <select
                    required
                    value={newCourse.subject}
                    onChange={(e) => setNewCourse({ ...newCourse, subject: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                  >
                    <option value="">Sélectionner une matière</option>
                    {(subjects.length > 0 ? subjects.map(s => s.name) : SCHOOL_SUBJECTS).map(subj => (
                      <option key={subj} value={subj}>{subj}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Classe / Niveau</label>
                  <select
                    required
                    value={newCourse.grade}
                    onChange={(e) => setNewCourse({ ...newCourse, grade: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                  >
                    <option value="">Sélectionner une classe</option>
                    {SCHOOL_CLASSES.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sujet du cours</label>
                <input
                  type="text"
                  required
                  value={newCourse.topic}
                  onChange={(e) => setNewCourse({ ...newCourse, topic: e.target.value })}
                  placeholder="Ex: Les fractions"
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Optionnel)</label>
                <textarea
                  value={newCourse.content}
                  onChange={(e) => setNewCourse({ ...newCourse, content: e.target.value })}
                  placeholder="Contenu textuel du cours..."
                  className="w-full h-32 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Document de cours (PDF/Image)</label>
                <div className="relative">
                  <input
                    type="file"
                    id="course-file"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                    accept=".pdf,image/*"
                  />
                  <label 
                    htmlFor="course-file"
                    className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-all"
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Paperclip size={18} />
                      <span className="font-medium">{selectedFile ? selectedFile.name : "Cliquez pour joindre un fichier"}</span>
                    </div>
                    {selectedFile && (
                      <button 
                        type="button"
                        onClick={(e) => { e.preventDefault(); setSelectedFile(null); }}
                        className="p-1 hover:bg-red-50 text-red-500 rounded-full"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </label>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={uploading}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:bg-indigo-400 flex items-center justify-center gap-2 relative overflow-hidden"
                >
                  {uploading ? (
                    <>
                      <div className="relative z-10 flex items-center gap-2">
                        <RefreshCw className="animate-spin" size={20} />
                        <span>{uploadProgress !== null ? `${Math.round(uploadProgress)}%` : 'Publication...'}</span>
                      </div>
                      {uploadProgress !== null && (
                        <div 
                          className="absolute inset-0 bg-white/20 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      )}
                    </>
                  ) : "Ajouter le cours"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
