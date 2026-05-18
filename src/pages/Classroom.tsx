import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, onSnapshot, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from '../lib/firebase';
import { Award, BookOpen, Link as LinkIcon, FileText, Video, Plus, ThumbsUp, ThumbsDown, Trash2, ExternalLink, X, Image as ImageIcon, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Student {
  id: string;
  nom: string;
  prenom: string;
  photo?: string;
  classe: string;
}

interface BehaviorPoint {
  id: string;
  student_id: string;
  teacher_id: string;
  points: number;
  reason: string;
  type: 'positive' | 'negative';
  timestamp: string;
}

interface Resource {
  id: string;
  class_name: string;
  teacher_id: string;
  prof_name?: string;
  prof_photo?: string;
  title: string;
  description: string;
  subject?: string;
  url: string;
  type: 'document' | 'link' | 'video' | 'image';
  timestamp: string;
}

const handleFirestoreError = (error: any, operation: string, path: string) => {
  console.error(`Firestore Error [${operation}] on ${path}:`, error);
  if (error.code === 'permission-denied') {
    return "Permission refusée. Vérifiez les règles de sécurité Firestore.";
  }
  return error.message || "Une erreur est survenue.";
};

const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Max dimensions
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Compression failed"));
          },
          'image/jpeg',
          0.7 // Quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

interface ClassroomProps {
  initialClassName?: string;
}

export default function Classroom({ initialClassName }: ClassroomProps) {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const { notifySuccess, notifyError, notifyDelete } = useNotification();
  const [loading, setLoading] = useState(true);
  
  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [points, setPoints] = useState<BehaviorPoint[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>(initialClassName || '');

  // Modals
  const [showPointModal, setShowPointModal] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Forms
  const [pointData, setPointData] = useState({ points: 1, reason: '', type: 'positive' as 'positive' | 'negative' });
  const [resourceData, setResourceData] = useState({ title: '', description: '', subject: '', url: '', type: 'document' as 'document' | 'link' | 'video' | 'image' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedPublishClasses, setSelectedPublishClasses] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !currentUser) return;

    const fetchData = async () => {
      try {
        if (currentUser.role === 'enseignant') {
          // Get classes where teacher is principal
          const principalQuery = query(collection(db, 'classes'), where('professeur_principal_id', '==', currentUser.id));
          const principalSnap = await getDocs(principalQuery);
          const principalClasses = principalSnap.docs.map(d => d.data().nom);
          
          // Get classes assigned in the teacher's profile
          const profileClasses = currentUser.classes || [];
          
          // Combine and remove duplicates
          const allTeacherClasses = Array.from(new Set([...principalClasses, ...profileClasses]));
          
          setTeacherClasses(allTeacherClasses);
          if (allTeacherClasses.length > 0 && !selectedClass) {
            setSelectedClass(allTeacherClasses[0]);
          }
        } else if (currentUser.role === 'élève') {
          setSelectedClass(currentUser.classe || '');
        }
      } catch (error) {
        console.error("Error fetching classes:", error);
      }
    };

    fetchData();
  }, [currentUser]);

  useEffect(() => {
    if (!selectedClass || !currentUser) {
      setLoading(false);
      return;
    }

    // Fetch students for the selected class
    const studentsQuery = query(collection(db, 'users'), where('role', '==', 'élève'), where('classe', '==', selectedClass));
    const unsubscribeStudents = onSnapshot(studentsQuery, (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    });

    // Fetch resources for the selected class
    const resourcesQuery = query(collection(db, 'resources'), where('class_name', '==', selectedClass));
    const unsubscribeResources = onSnapshot(resourcesQuery, (snap) => {
      const resData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resource));
      resData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setResources(resData);
    });

    // Fetch points
    let pointsQuery;
    if (currentUser.role === 'élève') {
      pointsQuery = query(collection(db, 'behavior_points'), where('student_id', '==', currentUser.id));
    } else {
      // For teachers, we fetch points for all students in the class
      // Since we can't easily do an 'in' query with a dynamic list of students if it's > 10,
      // we'll fetch all points given by this teacher and filter in memory, or just fetch all points.
      // For simplicity, we fetch points given by this teacher.
      pointsQuery = query(collection(db, 'behavior_points'), where('teacher_id', '==', currentUser.id));
    }

    const unsubscribePoints = onSnapshot(pointsQuery, (snap) => {
      const ptsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BehaviorPoint));
      ptsData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPoints(ptsData);
      setLoading(false);
    });

    return () => {
      unsubscribeStudents();
      unsubscribeResources();
      unsubscribePoints();
    };
  }, [selectedClass, currentUser]);

  const handleGivePoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !currentUser) return;
    
    setActionLoading(true);
    try {
      const pointsValue = pointData.type === 'positive' ? Math.abs(pointData.points) : -Math.abs(pointData.points);
      
      await addDoc(collection(db, 'behavior_points'), {
        student_id: selectedStudent.id,
        teacher_id: currentUser.id,
        points: pointsValue,
        reason: pointData.reason,
        type: pointData.type,
        timestamp: new Date().toISOString()
      });

      // Create a notification for the student
      await addDoc(collection(db, 'notifications'), {
        user_id: selectedStudent.id,
        title: pointData.type === 'positive' ? t('behavior_points_added') : t('behavior_warning'),
        message: `${pointsValue > 0 ? '+' : ''}${pointsValue} points : ${pointData.reason}`,
        type: pointData.type === 'positive' ? 'success' : 'warning',
        timestamp: new Date().toISOString(),
        read: false
      });

      setShowPointModal(false);
      setPointData({ points: 1, reason: '', type: 'positive' });
      notifySuccess("Points attribués avec succès !");
    } catch (error) {
      const message = handleFirestoreError(error, 'add', 'behavior_points');
      notifyError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const classesToPublish = selectedPublishClasses.length > 0 ? selectedPublishClasses : [selectedClass];
    if (classesToPublish.length === 0) return;

    setActionLoading(true);
    setUploadProgress(10); // Immediate feedback
    try {
      let fileUrl = resourceData.url;

      if ((resourceData.type === 'document' || resourceData.type === 'image') && selectedFile) {
        // Check file size (limit to 50MB)
        if (selectedFile.size > 50 * 1024 * 1024) {
          throw new Error("Le fichier est trop volumineux (max 50Mo)");
        }

        let fileToUpload: File | Blob = selectedFile;
        
        // Compress image if applicable
        if (resourceData.type === 'image' && selectedFile.type.startsWith('image/')) {
          try {
            fileToUpload = await compressImage(selectedFile);
          } catch (err) {
            console.warn("Compression failed, uploading original", err);
          }
        }

        const fileRef = ref(storage, `resources/${Date.now()}_${selectedFile.name}`);
        
        // Optimization: Use uploadBytes for files < 5MB for much faster initiation
        if (fileToUpload.size < 5 * 1024 * 1024) { 
          const { uploadBytes } = await import('firebase/storage');
          
          // Fake progress increments to avoid UI hanging
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => {
              if (prev === null) return 10;
              if (prev >= 90) return prev;
              return prev + 15;
            });
          }, 300);

          try {
            const uploadResult = await uploadBytes(fileRef, fileToUpload);
            clearInterval(progressInterval);
            setUploadProgress(95);
            fileUrl = await getDownloadURL(uploadResult.ref);
          } catch (error) {
            clearInterval(progressInterval);
            throw error;
          }
        } else {
          const { uploadBytesResumable } = await import('firebase/storage');
          const uploadTask = uploadBytesResumable(fileRef, fileToUpload);

          fileUrl = await new Promise((resolve, reject) => {
            uploadTask.on('state_changed', 
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 90;
                setUploadProgress(10 + progress);
              }, 
              (error) => {
                console.error("Upload error:", error);
                reject(error);
              }, 
              async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
              }
            );
          });
        }
      }

      if (!fileUrl && (resourceData.type === 'document' || resourceData.type === 'image')) {
        throw new Error("Veuillez sélectionner un fichier ou entrer une URL");
      }

      if (!fileUrl && (resourceData.type === 'link' || resourceData.type === 'video')) {
        throw new Error("Veuillez entrer une URL");
      }

      setUploadProgress(95);
      
      console.log("Finalizing publication with classes:", classesToPublish);
      
      const resourceEntry = {
        class_name: '', // Will be set in loop
        teacher_id: currentUser.id,
        prof_name: `${currentUser.prenom} ${currentUser.nom}`,
        prof_photo: currentUser.photo || '',
        title: resourceData.title,
        description: resourceData.description,
        subject: resourceData.subject || (currentUser.matieres?.[0] || currentUser.matiere || ''),
        url: fileUrl,
        type: resourceData.type,
        timestamp: new Date().toISOString()
      };

      // Use a loop for more reliable tracking than Promise.all if one fails
      for (const cls of classesToPublish) {
        await addDoc(collection(db, 'resources'), {
          ...resourceEntry,
          class_name: cls
        });
      }
      
      setUploadProgress(100);
      notifySuccess(`Publication réussie dans ${classesToPublish.length} classe(s) !`);
      
      // Short delay to show 100% success
      setTimeout(() => {
        setShowResourceModal(false);
        setResourceData({ title: '', description: '', subject: '', url: '', type: 'document' });
        setSelectedFile(null);
        setSelectedPublishClasses([]);
        setUploadProgress(null);
        setActionLoading(false);
      }, 500);
    } catch (error: any) {
      console.error("Publication error detail:", error);
      notifyError("Erreur lors de la publication: " + (error.message || "Erreur inconnue"));
    } finally {
      setActionLoading(false);
      setUploadProgress(null);
    }
  };

  const handleDeletePoint = async (pointId: string) => {
    if (!window.confirm(t('delete_user_confirm'))) return;
    try {
      await deleteDoc(doc(db, 'behavior_points', pointId));
      notifyDelete("Point supprimé.");
    } catch (error) {
      console.error("Error deleting point:", error);
      notifyError("Erreur lors de la suppression du point.");
    }
  };

  const handleDeleteResource = async (resourceId: string, resourceUrl: string, type: string) => {
    if (!window.confirm(t('delete_user_confirm'))) return;
    try {
      await deleteDoc(doc(db, 'resources', resourceId));
      if ((type === 'document' || type === 'image') && resourceUrl.includes('firebasestorage.googleapis.com')) {
        const fileRef = ref(storage, resourceUrl);
        await deleteObject(fileRef).catch(console.error);
      }
      notifyDelete("Ressource supprimée.");
    } catch (error) {
      console.error("Error deleting resource:", error);
      notifyError("Erreur lors de la suppression de la ressource.");
    }
  };

  const getStudentTotalPoints = (studentId: string) => {
    return points.filter(p => p.student_id === studentId).reduce((sum, p) => sum + p.points, 0);
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video size={20} className="text-pink-500" />;
      case 'link': return <LinkIcon size={20} className="text-blue-500" />;
      case 'image': return <ImageIcon size={20} className="text-purple-500" />;
      default: return <FileText size={20} className="text-amber-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('classroom')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {currentUser?.role === 'enseignant' ? t('classroom_subtitle_teacher') : t('classroom_subtitle_student')}
          </p>
        </div>

        {currentUser?.role === 'enseignant' && teacherClasses.length > 0 && (
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {teacherClasses.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        )}
      </div>

      {(!selectedClass && currentUser?.role === 'enseignant') ? (
        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-center">
          {t('no_class_assigned')}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Students & Points */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Award className="text-indigo-600" size={20} />
                  {currentUser?.role === 'enseignant' ? t('students_behavior') : t('my_behavior_points')}
                </h2>
              </div>
              
              <div className="p-6">
                {currentUser?.role === 'enseignant' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {students.map(student => {
                      const totalPoints = getStudentTotalPoints(student.id);
                      return (
                        <div 
                          key={student.id}
                          onClick={() => {
                            setSelectedStudent(student);
                            setShowPointModal(true);
                          }}
                          className="bg-gray-50 rounded-xl p-4 flex flex-col items-center text-center cursor-pointer hover:bg-indigo-50 hover:ring-2 hover:ring-indigo-500 transition-all group"
                        >
                          <div className="relative mb-3">
                            {student.photo ? (
                              <img src={student.photo} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm" />
                            ) : (
                              <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold border-2 border-white shadow-sm">
                                {student.prenom?.[0]}{student.nom?.[0]}
                              </div>
                            )}
                            <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                              totalPoints > 0 ? 'bg-emerald-500' : totalPoints < 0 ? 'bg-red-500' : 'bg-gray-400'
                            }`}>
                              {totalPoints > 0 ? '+' : ''}{totalPoints}
                            </div>
                          </div>
                          <p className="font-medium text-gray-900 text-sm line-clamp-1">{student.prenom}</p>
                          <p className="text-xs text-gray-500 line-clamp-1">{student.nom}</p>
                        </div>
                      );
                    })}
                    {students.length === 0 && (
                      <div className="col-span-full text-center py-8 text-gray-500">
                        {t('no_student_in_class')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-center p-8 bg-indigo-50 rounded-2xl">
                      <div className="text-center">
                        <p className="text-sm font-medium text-indigo-600 mb-2">{t('total_points')}</p>
                        <div className={`text-5xl font-black ${getStudentTotalPoints(currentUser.id) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {getStudentTotalPoints(currentUser.id) > 0 ? '+' : ''}{getStudentTotalPoints(currentUser.id)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900">{t('history')}</h3>
                      {points.length === 0 ? (
                        <p className="text-sm text-gray-500">{t('no_points_recorded')}</p>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {points.map(pt => (
                            <div key={pt.id} className="py-3 flex items-center justify-between group">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  pt.type === 'positive' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                                }`}>
                                  {pt.type === 'positive' ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{pt.reason}</p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(pt.timestamp).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`font-bold ${pt.type === 'positive' ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {pt.points > 0 ? '+' : ''}{pt.points}
                                </span>
                                {currentUser?.role === 'enseignant' && (
                                  <button 
                                    onClick={() => handleDeletePoint(pt.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Resources */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen className="text-indigo-600" size={20} />
                  {t('class_story')}
                </h2>
                {currentUser?.role === 'enseignant' && (
                  <button 
                    onClick={() => {
                      setSelectedPublishClasses([selectedClass]);
                      setShowResourceModal(true);
                    }}
                    className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    <Plus size={18} />
                  </button>
                )}
              </div>
              
              <div className="p-6">
                {resources.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <BookOpen size={32} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-sm">{t('no_resources_shared')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {resources.map((resource, index) => (
                          <motion.div 
                            key={resource.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: index * 0.05 }}
                            className="block p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all group relative bg-white"
                          >
                           <a 
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-3"
                            >
                              <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-indigo-50 transition-colors">
                                {getResourceIcon(resource.type)}
                              </div>
                              <div className="flex-1 pr-8">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1">
                                    {resource.title}
                                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </h3>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800">
                                    {resource.class_name}
                                  </span>
                                  {resource.subject && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">
                                      {resource.subject}
                                    </span>
                                  )}
                                </div>
                                {resource.description && (
                                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{resource.description}</p>
                                )}
                                
                                <div className="flex items-center gap-2 mt-3">
                                   {resource.prof_photo ? (
                                     <img src={resource.prof_photo} alt="" className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" />
                                   ) : (
                                     <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-400 uppercase">
                                       {resource.prof_name?.[0] || 'P'}
                                     </div>
                                   )}
                                   <span className="text-[10px] text-gray-500 font-medium">Par {resource.prof_name || 'Enseignant'}</span>
                                   <span className="text-[10px] text-gray-300">•</span>
                                   <span className="text-[10px] text-gray-400">
                                     {new Date(resource.timestamp).toLocaleDateString()}
                                   </span>
                                </div>

                                {resource.type === 'image' && (
                                  <div className="mt-3 rounded-lg overflow-hidden border border-gray-100">
                                    <img src={resource.url} alt={resource.title} className="w-full max-h-64 object-cover" />
                                  </div>
                                )}
                              </div>
                            </a>
                            {currentUser?.role === 'enseignant' && (
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDeleteResource(resource.id, resource.url, resource.type);
                                }}
                                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Give Points Modal */}
      {showPointModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 sticky top-0 z-10">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {t('evaluate')} {selectedStudent.prenom} {selectedStudent.nom}
              </h3>
              <button onClick={() => setShowPointModal(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('history')}</h4>
                {points.filter(p => p.student_id === selectedStudent.id).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('no_points_recorded')}</p>
                ) : (
                  <div className="space-y-2">
                    {points.filter(p => p.student_id === selectedStudent.id).map(pt => (
                      <div key={pt.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700 group">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            pt.type === 'positive' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {pt.type === 'positive' ? <ThumbsUp size={12} /> : <ThumbsDown size={12} />}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-900 dark:text-white">{pt.reason}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{new Date(pt.timestamp).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${pt.type === 'positive' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {pt.points > 0 ? '+' : ''}{pt.points}
                          </span>
                          <button 
                            onClick={() => handleDeletePoint(pt.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleGivePoints} className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPointData({ ...pointData, type: 'positive' })}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                      pointData.type === 'positive' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'border-gray-100 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <ThumbsUp size={24} />
                    <span className="font-medium">{t('positive')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPointData({ ...pointData, type: 'negative' })}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                      pointData.type === 'negative' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'border-gray-100 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <ThumbsDown size={24} />
                    <span className="font-medium">{t('needs_improvement')}</span>
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('number_of_points')}</label>
                  <input 
                    type="number" 
                    min="1"
                    max="10"
                    required
                    value={pointData.points}
                    onChange={(e) => setPointData({...pointData, points: parseInt(e.target.value) || 1})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('reason_comment')}</label>
                  <input 
                    type="text" 
                    required
                    placeholder={t('reason_placeholder')}
                    value={pointData.reason}
                    onChange={(e) => setPointData({...pointData, reason: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3 bg-white dark:bg-gray-800 sticky bottom-0 z-10">
                  <button 
                    type="button"
                    onClick={() => setShowPointModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors order-2 sm:order-1"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    type="submit"
                    disabled={actionLoading}
                    className={`flex-1 px-4 py-2.5 text-white rounded-xl font-medium disabled:opacity-50 transition-all order-1 sm:order-2 ${
                      pointData.type === 'positive' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {actionLoading ? t('save') + '...' : t('save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Resource Modal */}
      {showResourceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 sticky top-0 z-10">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('share_resource')}</h3>
              <button onClick={() => setShowResourceModal(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddResource} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('resource_type')}</label>
                <select 
                  value={resourceData.type}
                  onChange={(e) => setResourceData({...resourceData, type: e.target.value as any})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="document">{t('document_pdf_word')}</option>
                  <option value="image">{t('image_photo')}</option>
                  <option value="link">{t('web_link')}</option>
                  <option value="video">{t('video')}</option>
                </select>
              </div>

              {currentUser?.role === 'enseignant' && teacherClasses.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('publish_to')}</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto p-3 border border-gray-200 rounded-xl bg-gray-50">
                    {teacherClasses.map(cls => (
                      <label key={cls} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPublishClasses.includes(cls)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPublishClasses([...selectedPublishClasses, cls]);
                            } else {
                              setSelectedPublishClasses(selectedPublishClasses.filter(c => c !== cls));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">{cls}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('title')}</label>
                <input 
                  type="text" 
                  required
                  value={resourceData.title}
                  onChange={(e) => setResourceData({...resourceData, title: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('title_placeholder')}
                />
              </div>

              {currentUser.role === 'enseignant' && (currentUser.matieres || (currentUser.matiere ? [currentUser.matiere] : [])).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('subject')}</label>
                  <select 
                    value={resourceData.subject}
                    onChange={(e) => setResourceData({...resourceData, subject: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Sélectionner une matière</option>
                    {(currentUser.matieres || (currentUser.matiere ? [currentUser.matiere] : [])).map((m: string) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {resourceData.type === 'document' || resourceData.type === 'image' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('file_upload')}</label>
                  <input 
                    type="file" 
                    accept={resourceData.type === 'image' ? 'image/*' : undefined}
                    required
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('url_link')}</label>
                  <input 
                    type="url" 
                    required
                    value={resourceData.url}
                    onChange={(e) => setResourceData({...resourceData, url: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://..."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('description_optional')}</label>
                <textarea 
                  rows={3}
                  value={resourceData.description}
                  onChange={(e) => setResourceData({...resourceData, description: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder={t('description_placeholder')}
                />
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3 bg-white dark:bg-gray-800 sticky bottom-0 z-10">
                <button 
                  type="button"
                  onClick={() => setShowResourceModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors order-2 sm:order-1"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium disabled:opacity-50 relative overflow-hidden transition-all order-1 sm:order-2"
                >
                  {actionLoading ? (
                    <>
                      <div className="relative z-10 flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{uploadProgress !== null ? `${Math.round(uploadProgress)}%` : t('sharing')}</span>
                      </div>
                      {uploadProgress !== null && (
                        <div 
                          className="absolute inset-0 bg-white/20 transition-all duration-500 ease-out" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      )}
                    </>
                  ) : t('share')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
