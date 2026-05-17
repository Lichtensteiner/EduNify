import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  MapPin, 
  BookOpen, 
  Users, 
  Trash2, 
  Edit2, 
  Search, 
  X, 
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PlanningItem {
  id: string;
  teacherId: string;
  teacherName: string;
  title: string;
  description: string;
  startTime: Timestamp;
  endTime: Timestamp;
  type: 'cours' | 'réunion' | 'examen' | 'autre';
  classId?: string;
  className?: string;
  subject?: string;
  createdAt: Timestamp;
}

const TeacherPlanning: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, language } = useLanguage();
  const { notifySuccess, notifyError, notifyDelete } = useNotification();
  
  const [planning, setPlanning] = useState<PlanningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PlanningItem | null>(null);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  
  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  const getOneHourLater = () => {
    const later = new Date(Date.now() + 3600000);
    return `${later.getHours().toString().padStart(2, '0')}:${later.getMinutes().toString().padStart(2, '0')}`;
  };

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'cours',
    classId: '',
    className: '',
    subject: '',
    startDate: new Date().toISOString().split('T')[0],
    startTime: getCurrentTime(),
    endDate: new Date().toISOString().split('T')[0],
    endTime: getOneHourLater()
  });

  const isTeacher = currentUser?.role === 'enseignant';
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (!currentUser) return;

    // Filter for the last 24 hours + future
    const startLimit = new Date();
    startLimit.setHours(0, 0, 0, 0); // Use start of today for more stable query

    let q = query(
      collection(db, 'teacher_planning'),
      orderBy('startTime', 'asc')
    );

    if (isTeacher) {
      // Simplify query to avoid composite index requirement
      q = query(
        collection(db, 'teacher_planning'),
        where('teacherId', '==', currentUser.id)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlanningItem[];

      // Filter by startTime in memory to avoid needing a composite index
      items = items.filter(item => {
        const itemDate = item.startTime?.toDate?.() || new Date(0);
        return itemDate >= startLimit;
      });

      // Sort in memory since we removed the orderBy from the teacher query
      items.sort((a, b) => {
        const timeA = a.startTime?.toDate?.().getTime() || 0;
        const timeB = b.startTime?.toDate?.().getTime() || 0;
        return timeA - timeB;
      });

      setPlanning(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'teacher_planning');
      setLoading(false);
    });

    // Fetch classes and teacher's subjects for the form
    const unsubscribeClasses = onSnapshot(collection(db, 'classes'), (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().nom || doc.data().name })));
    });

    if (isTeacher) {
      setSubjects(currentUser.matieres || (currentUser.matiere ? [currentUser.matiere] : []));
    }

    return () => {
      unsubscribe();
      unsubscribeClasses();
    };
  }, [currentUser, isTeacher, isAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTeacher) return;

    try {
      // Validate time and date inputs
      if (!formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
        notifyError("Veuillez remplir toutes les dates et heures.");
        return;
      }

      const startString = `${formData.startDate}T${formData.startTime}`;
      const endString = `${formData.endDate}T${formData.endTime}`;
      
      const start = new Date(startString);
      const end = new Date(endString);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        notifyError("Format de date ou heure invalide.");
        return;
      }

      if (end <= start) {
        notifyError(t('end_before_start_error'));
        return;
      }

      const selectedClass = classes.find(c => c.id === formData.classId);

      const data = {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        classId: formData.classId,
        className: selectedClass?.name || '',
        subject: formData.subject,
        startTime: Timestamp.fromDate(start),
        endTime: Timestamp.fromDate(end),
        teacherId: currentUser.id,
        teacherName: `${currentUser.prenom} ${currentUser.nom}`,
        updatedAt: serverTimestamp()
      };

      if (editingItem) {
        await updateDoc(doc(db, 'teacher_planning', editingItem.id), data);
        notifySuccess(t('activity_saved'));
      } else {
        await addDoc(collection(db, 'teacher_planning'), {
          ...data,
          createdAt: serverTimestamp()
        });
        notifySuccess(t('activity_saved'));
      }

      setShowAddModal(false);
      setEditingItem(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'teacher_planning');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'cours',
      classId: '',
      className: '',
      subject: '',
      startDate: new Date().toISOString().split('T')[0],
      startTime: getCurrentTime(),
      endDate: new Date().toISOString().split('T')[0],
      endTime: getOneHourLater()
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('teacher_planning_delete_confirm'))) return;
    try {
      await deleteDoc(doc(db, 'teacher_planning', id));
      notifyDelete(t('activity_deleted'));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `teacher_planning/${id}`);
    }
  };

  const openEdit = (item: PlanningItem) => {
    setEditingItem(item);
    const start = item.startTime?.toDate?.() || new Date();
    const end = item.endTime?.toDate?.() || new Date();
    
    const formatTime = (date: Date) => {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    setFormData({
      title: item.title,
      description: item.description || '',
      type: item.type,
      classId: item.classId || '',
      className: item.className || '',
      subject: item.subject || '',
      startDate: start.toISOString().split('T')[0],
      startTime: formatTime(start),
      endDate: end.toISOString().split('T')[0],
      endTime: formatTime(end)
    });
    setShowAddModal(true);
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'cours': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'réunion': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'examen': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="text-indigo-600" />
            {t('planning')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {isTeacher ? t('teacher_planning_desc') : t('consult_teacher_planning_desc')}
          </p>
        </div>
        
        {isTeacher && (
          <button
            onClick={() => { resetForm(); setEditingItem(null); setShowAddModal(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={20} />
            {t('add_activity')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Statistics or Summary Widgets */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="text-indigo-500" />
              {t('today')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{t('total_activities')}</span>
                <span className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">{planning.length}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                {t('activity_display_notice')}
              </p>
            </div>
          </div>
        </div>

        {/* Planning List */}
        <div className="md:col-span-2">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : planning.length > 0 ? (
            <div className="space-y-4">
              {(() => {
                const now = new Date();
                return planning.map((item) => {
                  const start = item.startTime?.toDate?.() || new Date();
                  const end = item.endTime?.toDate?.() || new Date();
                  const isPast = end < now;
                  const isCurrent = start <= now && end >= now;

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border transition-all ${
                        isCurrent ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-gray-100 dark:border-gray-700'
                      } ${isPast ? 'opacity-60' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getBadgeColor(item.type)}`}>
                            {item.type}
                          </span>
                          {isCurrent && (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-[10px] font-bold animate-pulse">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                              {t('in_progress_caps')}
                            </span>
                          )}
                        </div>
                        
                        {isTeacher && item.teacherId === currentUser.id && (
                          <div className="flex gap-1">
                            <button 
                              onClick={() => openEdit(item)}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 line-clamp-1">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{item.description}</p>
                      )}

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50 dark:border-gray-700/50 mt-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <Clock size={16} className="text-indigo-500" />
                          <span>
                            {item.startTime?.toDate?.().toLocaleTimeString(language === 'fr' ? 'fr-FR' : language, { hour: '2-digit', minute: '2-digit' }) || '--:--'} - {item.endTime?.toDate?.().toLocaleTimeString(language === 'fr' ? 'fr-FR' : language, { hour: '2-digit', minute: '2-digit' }) || '--:--'}
                          </span>
                        </div>
                        {(item.className || (item as any).class_nom) && (
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 justify-end">
                            <Users size={16} className="text-indigo-500" />
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {item.className || (item as any).class_nom}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <CalendarIcon size={16} className="text-indigo-500" />
                          <span>{item.startTime?.toDate?.().toLocaleDateString(language === 'fr' ? 'fr-FR' : language, { day: 'numeric', month: 'short' }) || 'N/A'}</span>
                        </div>
                        {item.subject && (
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 justify-end">
                            <BookOpen size={16} className="text-indigo-500" />
                            <span className="font-medium text-gray-700 dark:text-gray-300">{item.subject}</span>
                          </div>
                        )}
                      </div>
                      
                      {isAdmin && (
                        <div className="mt-4 pt-3 border-t border-dashed border-gray-100 dark:border-gray-700 flex items-center justify-between">
                           <span className="text-[10px] text-gray-400 uppercase font-medium">{t('teacher')}</span>
                           <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{item.teacherName}</span>
                        </div>
                      )}
                    </motion.div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
              <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900/50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarIcon size={40} />
              </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {t('no_activity_planned')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              {isTeacher ? t('add_first_activity_desc') : t('no_planning_recorded')}
            </p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingItem ? t('edit') : t('add_activity')}
                </h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2 ml-1">{t('activity_title')}</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      placeholder={t('activity_title_placeholder')}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2 ml-1">{t('activity_type')}</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {['cours', 'réunion', 'examen', 'autre'].map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData({...formData, type: type as any})}
                          className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                            formData.type === type 
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                              : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-indigo-300'
                          }`}
                        >
                          {type === 'cours' ? t('classroom') : type === 'réunion' ? t('event_meeting') : type === 'examen' ? t('event_exam') : t('other')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2 ml-1">{t('description_optional')}</label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2 ml-1">{t('class')}</label>
                    <select
                      value={formData.classId}
                      onChange={e => setFormData({...formData, classId: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                    >
                      <option value="">{t('select_class')}</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2 ml-1">{t('subject')}</label>
                    <select
                      value={formData.subject}
                      onChange={e => setFormData({...formData, subject: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                    >
                      <option value="">{t('select_subject')}</option>
                      {subjects.map((s, idx) => (
                        <option key={idx} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2 ml-1">{t('start_date_label')}</label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={e => setFormData({...formData, startDate: e.target.value, endDate: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm text-center font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2 ml-1">{t('start_time_label')}</label>
                    <input
                      type="time"
                      required
                      value={formData.startTime}
                      onChange={e => setFormData({...formData, startTime: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm text-center font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2 ml-1">{t('end_date_label')}</label>
                    <input
                      type="date"
                      required
                      value={formData.endDate}
                      onChange={e => setFormData({...formData, endDate: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm text-center font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2 ml-1">{t('end_time_label')}</label>
                    <input
                      type="time"
                      required
                      value={formData.endTime}
                      onChange={e => setFormData({...formData, endTime: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm text-center font-bold"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
                  >
                    {editingItem ? t('save_changes') : t('add_to_planning')}
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

export default TeacherPlanning;
