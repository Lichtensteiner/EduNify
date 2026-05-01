import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db, storage } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  BookOpen, 
  Calendar, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Clock, 
  FileText,
  Trash2,
  AlertCircle,
  Download,
  Paperclip,
  X,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HomeworkItem {
  id: string;
  classId: string;
  subject: string;
  title: string;
  description: string;
  dueDate: any;
  createdAt: any;
  teacherId: string;
  teacherName: string;
  completedBy: string[]; // Array of student UIDs
  fileUrl?: string;
  fileName?: string;
}

const Homework: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, language } = useLanguage();
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [newHomework, setNewHomework] = useState({
    subject: '',
    title: '',
    description: '',
    dueDate: '',
    classId: ''
  });

  useEffect(() => {
    if (!currentUser) return;

    let homeworkQuery;
    if (currentUser.role === 'élève' && currentUser.classe) {
      homeworkQuery = query(
        collection(db, 'homework'),
        where('classId', '==', currentUser.classe)
      );
    } else if (currentUser.role === 'enseignant') {
      homeworkQuery = query(
        collection(db, 'homework'),
        where('teacherId', '==', currentUser.id)
      );
    } else {
      homeworkQuery = query(
        collection(db, 'homework'),
        orderBy('dueDate', 'asc')
      );
    }

    const unsubscribe = onSnapshot(homeworkQuery, (snapshot) => {
      const homeworkData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HomeworkItem[];
      
      // Sort client-side to avoid requiring composite indexes
      homeworkData.sort((a, b) => {
        const dateA = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
        const dateB = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
        return dateA.getTime() - dateB.getTime();
      });

      setHomework(homeworkData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching homework:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleToggleComplete = async (homeworkId: string, isCompleted: boolean) => {
    if (!currentUser || currentUser.role !== 'élève') return;

    const homeworkRef = doc(db, 'homework', homeworkId);
    const item = homework.find(h => h.id === homeworkId);
    if (!item) return;

    let newCompletedBy = [...(item.completedBy || [])];
    if (isCompleted) {
      newCompletedBy = newCompletedBy.filter(id => id !== currentUser.id);
    } else {
      newCompletedBy.push(currentUser.id);
    }

    try {
      await updateDoc(homeworkRef, { completedBy: newCompletedBy });
    } catch (error) {
      console.error("Error updating homework status:", error);
    }
  };

  const handleAddHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setUploading(true);
    setUploadProgress(10);
    try {
      let fileData = {};
      
      if (selectedFile) {
        const fileRef = ref(storage, `homework/${Date.now()}_${selectedFile.name}`);
        
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

      await addDoc(collection(db, 'homework'), {
        ...newHomework,
        ...fileData,
        teacherId: currentUser.id,
        teacherName: `${currentUser.prenom} ${currentUser.nom}`,
        createdAt: serverTimestamp(),
        completedBy: [],
        dueDate: new Date(newHomework.dueDate)
      });
      
      setUploadProgress(100);
      
      setTimeout(() => {
        setShowAddModal(false);
        setNewHomework({ subject: '', title: '', description: '', dueDate: '', classId: '' });
        setSelectedFile(null);
        setUploadProgress(null);
        setUploading(false);
      }, 500);
    } catch (error) {
      console.error("Error adding homework:", error);
      alert("Une erreur est survenue lors de l'ajout du devoir.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDeleteHomework = async (id: string) => {
    if (window.confirm(t('confirm_delete'))) {
      try {
        await deleteDoc(doc(db, 'homework', id));
      } catch (error) {
        console.error("Error deleting homework:", error);
      }
    }
  };

  const isOverdue = (dueDate: any) => {
    if (!dueDate) return false;
    const date = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
    return date < new Date() && date.toDateString() !== new Date().toDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="text-indigo-600" />
            {t('homework')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {currentUser?.role === 'élève' ? 'Travail à faire et contenu des cours' : 'Gérez les devoirs et le cahier de textes'}
          </p>
        </div>

        {currentUser?.role === 'enseignant' && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} />
            Ajouter un devoir
          </button>
        )}
      </div>

      {/* Homework List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Chargement des devoirs...
          </div>
        ) : homework.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-dashed border-gray-300 dark:border-gray-700">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <BookOpen size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Aucun devoir</h3>
            <p className="text-gray-500 dark:text-gray-400">Il n'y a aucun travail à faire pour le moment.</p>
          </div>
        ) : (
          homework.map((item, index) => {
            const isCompleted = currentUser?.role === 'élève' && item.completedBy?.includes(currentUser.id);
            const overdue = isOverdue(item.dueDate);
            
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border transition-all ${
                  isCompleted 
                    ? 'border-emerald-100 dark:border-emerald-900/30 opacity-75' 
                    : overdue 
                      ? 'border-red-100 dark:border-red-900/30' 
                      : 'border-gray-100 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start gap-4">
                  {currentUser?.role === 'élève' && (
                    <button 
                      onClick={() => handleToggleComplete(item.id, !!isCompleted)}
                      className={`mt-1 transition-colors ${isCompleted ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600 hover:text-indigo-500'}`}
                    >
                      {isCompleted ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </button>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md text-xs font-bold uppercase tracking-wider">
                          {item.subject}
                        </span>
                        {overdue && !isCompleted && (
                          <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md">
                            <AlertCircle size={12} />
                            En retard
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Clock size={16} />
                        <span>Pour le {item.dueDate?.toDate ? item.dueDate.toDate().toLocaleDateString(language) : 'N/A'}</span>
                      </div>
                    </div>
                    
                    <h3 className={`text-lg font-bold mb-2 ${isCompleted ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                      {item.title}
                    </h3>
                    
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 whitespace-pre-wrap">
                      {item.description}
                    </p>

                    {item.fileUrl && (
                      <div className="mb-4">
                        <a 
                          href={item.fileUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors"
                        >
                          <Paperclip size={14} />
                          <span className="truncate max-w-[200px]">{item.fileName || "Voir le document"}</span>
                          <Download size={14} className="ml-1" />
                        </a>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                          {item.teacherName?.charAt(0)}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{item.teacherName}</span>
                      </div>
                      
                      {currentUser?.role === 'enseignant' && (
                        <button 
                          onClick={() => handleDeleteHomework(item.id)}
                          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Add Homework Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ajouter un devoir</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
              
              <form onSubmit={handleAddHomework} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Matière</label>
                    <input
                      type="text"
                      required
                      value={newHomework.subject}
                      onChange={(e) => setNewHomework({...newHomework, subject: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="Ex: Mathématiques"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date d'échéance</label>
                    <input
                      type="date"
                      required
                      value={newHomework.dueDate}
                      onChange={(e) => setNewHomework({...newHomework, dueDate: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titre</label>
                  <input
                    type="text"
                    required
                    value={newHomework.title}
                    onChange={(e) => setNewHomework({...newHomework, title: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Ex: Exercices sur les fractions"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description / Instructions</label>
                  <textarea
                    required
                    rows={4}
                    value={newHomework.description}
                    onChange={(e) => setNewHomework({...newHomework, description: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                    placeholder="Détaillez le travail à faire..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Document joint (Optionnel)</label>
                  <div className="relative">
                    <input
                      type="file"
                      id="homework-file"
                      className="hidden"
                      onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                      accept=".pdf,image/*"
                    />
                    <label 
                      htmlFor="homework-file"
                      className="flex items-center justify-between w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-all"
                    >
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Paperclip size={18} />
                        <span>{selectedFile ? selectedFile.name : "Choisir un fichier (PDF ou Image)"}</span>
                      </div>
                      {selectedFile && (
                        <button 
                          type="button"
                          onClick={(e) => { e.preventDefault(); setSelectedFile(null); }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-full"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </label>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    disabled={uploading}
                    className="flex-1 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 disabled:bg-indigo-400 flex items-center justify-center gap-2 relative overflow-hidden"
                  >
                    {uploading ? (
                      <>
                        <div className="relative z-10 flex items-center gap-2">
                          <RefreshCw className="animate-spin" size={18} />
                          <span>{uploadProgress !== null ? `${Math.round(uploadProgress)}%` : 'Envoi...'}</span>
                        </div>
                        {uploadProgress !== null && (
                          <div 
                            className="absolute inset-0 bg-white/20 transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        )}
                      </>
                    ) : 'Publier'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Homework;
