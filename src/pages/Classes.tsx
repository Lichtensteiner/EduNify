import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Users, Clock, Edit2, Trash2, X, User, GraduationCap, ChevronRight } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { useNotification } from '../contexts/NotificationContext';
import ClassDetailsView from '../components/ClassDetailsView';

export default function Classes() {
  const { notifyError } = useNotification();
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedClass, setSelectedClass] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    nom: '',
    niveau: '',
    professeur_principal_id: '',
    enseignants_ids: [] as string[],
    heure_debut: '08:00',
    matieres: [] as string[]
  });
  const [newMatiere, setNewMatiere] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    // Fetch classes
    const unsubscribeClasses = onSnapshot(collection(db, 'classes'), (snap) => {
      const classesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClasses(classesData);
    });

    // Fetch users (teachers and students)
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const usersData: any[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTeachers(usersData
        .filter(u => u.role === 'enseignant')
        .sort((a, b) => `${a.nom || ''} ${a.prenom || ''}`.trim().localeCompare(`${b.nom || ''} ${b.prenom || ''}`.trim())));
      setStudents(usersData
        .filter(u => u.role === 'élève')
        .sort((a, b) => `${a.nom || ''} ${a.prenom || ''}`.trim().localeCompare(`${b.nom || ''} ${b.prenom || ''}`.trim())));
      setLoading(false);
    });

    return () => {
      unsubscribeClasses();
      unsubscribeUsers();
    };
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.modal === 'class_details') {
        // Modal is open
      } else {
        setIsModalOpen(false);
        setSelectedClass(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenModal = (mode: 'create' | 'edit' | 'view', classItem?: any) => {
    setModalMode(mode);
    setSelectedClass(classItem || null);
    if (mode === 'edit' && classItem) {
      setFormData({
        nom: classItem.nom || '',
        niveau: classItem.niveau || '',
        professeur_principal_id: classItem.professeur_principal_id || '',
        enseignants_ids: classItem.enseignants_ids || [],
        heure_debut: classItem.heure_debut || '08:00',
        matieres: classItem.matieres || []
      });
    } else {
      setFormData({ nom: '', niveau: '', professeur_principal_id: '', enseignants_ids: [], heure_debut: '08:00', matieres: [] });
    }
    setIsModalOpen(true);
    if (mode === 'view') {
      window.history.pushState({ modal: 'class_details' }, '');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedClass(null);
    if (window.history.state?.modal === 'class_details') {
      window.history.back();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const prevName = selectedClass?.nom || '';
      const newName = formData.nom;
      
      const prevPrincipalId = selectedClass?.professeur_principal_id || '';
      const newPrincipalId = formData.professeur_principal_id;
      
      const prevEnseignantsIds = selectedClass?.enseignants_ids || [];
      const newEnseignantsIds = formData.enseignants_ids || [];

      if (modalMode === 'create') {
        const docRef = await addDoc(collection(db, 'classes'), {
          ...formData,
          timestamp: new Date().toISOString()
        });
        
        // SYNC: Update teachers' profiles to include this class name
        const assignedTeacherIds = new Set<string>([
          ...(newPrincipalId ? [newPrincipalId] : []),
          ...newEnseignantsIds
        ]);
        
        for (const tId of assignedTeacherIds) {
          const tDoc = teachers.find(t => t.id === tId);
          if (tDoc) {
            const currentClasses = Array.isArray(tDoc.classes) ? [...tDoc.classes] : [];
            if (!currentClasses.includes(newName)) {
              await updateDoc(doc(db, 'users', tId), {
                classes: [...currentClasses, newName]
              });
            }
          }
        }
      } else if (modalMode === 'edit' && selectedClass) {
        await updateDoc(doc(db, 'classes', selectedClass.id), {
          ...formData,
          updatedAt: new Date().toISOString()
        });

        // SYNC: Keep all teachers' classes arrays in sync
        const assignedTeacherIds = new Set<string>([
          ...(newPrincipalId ? [newPrincipalId] : []),
          ...newEnseignantsIds
        ]);

        const oldTeacherIds = new Set<string>([
          ...(prevPrincipalId ? [prevPrincipalId] : []),
          ...prevEnseignantsIds
        ]);

        const allConcernedTeacherIds = new Set([...assignedTeacherIds, ...oldTeacherIds]);

        for (const tId of allConcernedTeacherIds) {
          const tDoc = teachers.find(t => t.id === tId);
          if (tDoc) {
            let currentClasses = Array.isArray(tDoc.classes) ? [...tDoc.classes] : [];
            const isCurrentlyAssigned = assignedTeacherIds.has(tId);

            let updatedClasses = [...currentClasses];
            let countChanged = false;

            if (isCurrentlyAssigned) {
              if (prevName && prevName !== newName) {
                updatedClasses = updatedClasses.filter(c => c !== prevName);
                countChanged = true;
              }
              if (!updatedClasses.includes(newName)) {
                updatedClasses.push(newName);
                countChanged = true;
              }
            } else {
              if (prevName && updatedClasses.includes(prevName)) {
                updatedClasses = updatedClasses.filter(c => c !== prevName);
                countChanged = true;
              }
              if (updatedClasses.includes(newName)) {
                updatedClasses = updatedClasses.filter(c => c !== newName);
                countChanged = true;
              }
            }

            if (countChanged) {
              await updateDoc(doc(db, 'users', tId), {
                classes: updatedClasses
              });
            }
          }
        }
      }
      closeModal();
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      notifyError("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette classe ?")) {
      try {
        const classItem = classes.find(c => c.id === id);
        await deleteDoc(doc(db, 'classes', id));

        // SYNC: Remove class name from teacher classes profiles
        if (classItem && classItem.nom) {
          for (const t of teachers) {
            if (t.classes && Array.isArray(t.classes) && t.classes.includes(classItem.nom)) {
              const updated = t.classes.filter((c: string) => c !== classItem.nom);
              await updateDoc(doc(db, 'users', t.id), {
                classes: updated
              });
            }
          }
        }
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
      }
    }
  };

  const getTeacherName = (teacherId: string, className?: string) => {
    let teacher = teachers.find(t => t.id === teacherId);
    
    // If not found by ID, try to find a teacher who has this class name in their 'classes' array
    if (!teacher && className) {
      teacher = teachers.find(t => t.classes && t.classes.includes(className));
    }

    return teacher ? (teacher.prenom || teacher.nom ? `${teacher.prenom || ''} ${teacher.nom || ''}`.trim() : teacher.email?.split('@')[0] || 'Utilisateur') : 'Non assigné';
  };

  const handleQuickAssignTeacher = async (classId: string, teacherId: string) => {
    if (!teacherId || !classId) return;
    try {
      const classItem = classes.find(c => c.id === classId);
      if (!classItem) return;

      const prevPrincipalId = classItem.professeur_principal_id;

      await updateDoc(doc(db, 'classes', classId), { 
        professeur_principal_id: teacherId,
        updatedAt: new Date().toISOString()
      });
      
      // Sync new principal teacher
      const newTeacher = teachers.find(t => t.id === teacherId);
      if (newTeacher) {
        let currentClasses = Array.isArray(newTeacher.classes) ? [...newTeacher.classes] : [];
        if (!currentClasses.includes(classItem.nom)) {
          currentClasses.push(classItem.nom);
        }
        await updateDoc(doc(db, 'users', teacherId), {
          classe: classItem.nom,
          classes: currentClasses
        });
      }

      // Sync previous principal teacher if changed and not assigned as regular teacher
      if (prevPrincipalId && prevPrincipalId !== teacherId) {
        const prevTeacher = teachers.find(t => t.id === prevPrincipalId);
        const isStillRegularTeacher = classItem.enseignants_ids && classItem.enseignants_ids.includes(prevPrincipalId);
        if (prevTeacher && !isStillRegularTeacher) {
          let currentClasses = Array.isArray(prevTeacher.classes) ? [...prevTeacher.classes] : [];
          currentClasses = currentClasses.filter((c: string) => c !== classItem.nom);
          await updateDoc(doc(db, 'users', prevPrincipalId), {
            classes: currentClasses
          });
        }
      }
    } catch (err) {
      console.error("Error assigned principal teacher:", err);
    }
  };

  const getClassStudents = (className: string) => {
    return students.filter(s => s.classe === className);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Gestion des Classes</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez les classes, filières et emplois du temps</p>
        </div>
        <button 
          onClick={() => handleOpenModal('create')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
        >
          <Plus size={18} />
          Ajouter une classe
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
            <BookOpen size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Aucune classe configurée</h2>
          <p className="text-gray-500 max-w-md mb-6">
            Commencez par créer votre première classe pour y assigner des élèves et un professeur principal.
          </p>
          <button 
            onClick={() => handleOpenModal('create')}
            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Créer une classe
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => {
            const classStudents = getClassStudents(cls.nom);
            return (
              <div 
                key={cls.id} 
                onClick={() => handleOpenModal('view', cls)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden group"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <BookOpen size={24} />
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', cls); }}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(cls.id, e)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{cls.nom}</h3>
                  <div className="flex items-center gap-2 text-sm text-indigo-600 font-semibold mb-2">
                    <User size={14} />
                    {cls.professeur_principal_id ? (
                      <span>{getTeacherName(cls.professeur_principal_id, cls.nom)}</span>
                    ) : (
                      <select
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleQuickAssignTeacher(cls.id, e.target.value)}
                        className="text-[11px] py-1 px-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 transition-all font-bold"
                      >
                        <option value="">Assigner Prof. Principal</option>
                        {teachers.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.prenom || t.nom ? `${t.prenom || ''} ${t.nom || ''}`.trim() : t.email?.split('@')[0]}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-6">{cls.niveau || 'Niveau non spécifié'}</p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <GraduationCap size={16} className="text-gray-400" />
                      <span><span className="font-medium text-gray-900">{
                        (() => {
                          const uniqueIds = new Set<string>();
                          if (cls.professeur_principal_id) {
                            uniqueIds.add(cls.professeur_principal_id);
                          }
                          if (cls.enseignants_ids && Array.isArray(cls.enseignants_ids)) {
                            cls.enseignants_ids.forEach((id: string) => uniqueIds.add(id));
                          }
                          return uniqueIds.size;
                        })()
                      }</span> enseignants assignés</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Users size={16} className="text-gray-400" />
                      <span><span className="font-medium text-gray-900">{classStudents.length}</span> élèves inscrits</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Clock size={16} className="text-gray-400" />
                      <span>Début des cours: <span className="font-medium text-gray-900">{cls.heure_debut || '08:00'}</span></span>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-sm font-medium text-indigo-600">Voir les détails</span>
                  <ChevronRight size={16} className="text-indigo-600" />
                </div>
              </div>
            );
          })}
           {/* Modal Create/Edit */}
      {isModalOpen && (modalMode === 'create' || modalMode === 'edit') && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] sm:max-h-[88vh] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-750/70 transition-colors duration-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4.5 border-b border-gray-100 dark:border-gray-750 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
              <h2 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">
                {modalMode === 'create' ? 'Nouvelle Classe' : 'Modifier la Classe'}
              </h2>
              <button 
                onClick={closeModal} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-150 dark:hover:bg-gray-700 p-1.5 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
                <div>
                  <label className="block text-[10px] font-black text-gray-450 dark:text-gray-400 uppercase tracking-widest mb-1.5">Nom de la classe *</label>
                  <input
                    type="text"
                    required
                    value={formData.nom}
                    onChange={(e) => setFormData({...formData, nom: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm font-semibold"
                    placeholder="ex: Terminale S1"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-gray-450 dark:text-gray-400 uppercase tracking-widest mb-1.5">Niveau / Filière</label>
                  <input
                    type="text"
                    value={formData.niveau}
                    onChange={(e) => setFormData({...formData, niveau: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm font-semibold"
                    placeholder="ex: Lycée"
                  />
                </div>
  
                <div>
                  <label className="block text-[10px] font-black text-gray-450 dark:text-gray-400 uppercase tracking-widest mb-1.5">Professeur Principal</label>
                  <select
                    value={formData.professeur_principal_id}
                    onChange={(e) => setFormData({...formData, professeur_principal_id: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm font-semibold"
                  >
                    <option value="">Sélectionner un enseignant</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.prenom || t.nom ? `${t.prenom || ''} ${t.nom || ''}`.trim() : t.email?.split('@')[0] || 'Utilisateur'}
                      </option>
                    ))}
                  </select>
                </div>
  
                <div>
                  <label className="block text-[10px] font-black text-gray-450 dark:text-gray-400 uppercase tracking-widest mb-1.5">Enseignants de la classe</label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-32 overflow-y-auto p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900">
                    {teachers.map(t => (
                      <label key={t.id} className="flex items-center gap-2.5 p-1.5 hover:bg-white dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={(formData.enseignants_ids || []).includes(t.id)}
                          onChange={(e) => {
                            const currentIds = formData.enseignants_ids || [];
                            if (e.target.checked) {
                              setFormData({...formData, enseignants_ids: [...currentIds, t.id]});
                            } else {
                              setFormData({...formData, enseignants_ids: currentIds.filter(id => id !== t.id)});
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {t.prenom || t.nom ? `${t.prenom || ''} ${t.nom || ''}`.trim() : t.email?.split('@')[0] || 'Utilisateur'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
  
                <div>
                  <label className="block text-[10px] font-black text-gray-450 dark:text-gray-400 uppercase tracking-widest mb-1.5">Heure de début (Tolérance retard)</label>
                  <input
                    type="time"
                    required
                    value={formData.heure_debut}
                    onChange={(e) => setFormData({...formData, heure_debut: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm font-semibold"
                  />
                </div>
  
                <div>
                  <label className="block text-[10px] font-black text-gray-450 dark:text-gray-400 uppercase tracking-widest mb-1.5">Matières de la classe</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newMatiere}
                      onChange={(e) => setNewMatiere(e.target.value)}
                      placeholder="Ajouter une matière (ex: Mathématiques)"
                      className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newMatiere.trim()) {
                          setFormData({...formData, matieres: [...(formData.matieres || []), newMatiere.trim()]});
                          setNewMatiere('');
                        }
                      }}
                      className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(formData.matieres || []).map((m, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-xs font-bold rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                        {m}
                        <button 
                          type="button"
                          onClick={() => setFormData({...formData, matieres: formData.matieres.filter((_, i) => i !== idx)})}
                          className="hover:text-red-650 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
  
              <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-750 bg-gray-50/70 dark:bg-gray-850/30 flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-200 dark:hover:bg-gray-650 transition-colors uppercase tracking-wider"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors disabled:opacity-50 uppercase tracking-wider"
                >
                  {actionLoading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </div>
      )}

      {/* Modal View Details */}
      {isModalOpen && modalMode === 'view' && selectedClass && (
        <ClassDetailsView 
          classId={selectedClass.id} 
          className={selectedClass.nom} 
          onClose={closeModal} 
        />
      )}
    </div>
  );
}
