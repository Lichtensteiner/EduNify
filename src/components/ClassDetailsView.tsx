import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDocs, deleteDoc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Users, 
  User,
  History, 
  MessageCircle, 
  Calendar as CalendarIcon, 
  Plus, 
  UserPlus, 
  MoreVertical, 
  Trash2, 
  Send,
  Clock,
  Image as ImageIcon,
  Video,
  Link as LinkIcon,
  FileText,
  ChevronRight,
  Search,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  X,
  ArrowLeft,
  Award,
  Shield,
  UserCheck,
  GraduationCap
} from 'lucide-react';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as BigCalendar, dateFnsLocalizer, Views, View } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import Chat from '../pages/Chat';

const locales = {
  'fr': fr,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface Student {
  id: string;
  prenom: string;
  nom: string;
  photo?: string;
  points?: number;
}

interface ClassEvent {
  id: string;
  title: string;
  description: string;
  location?: string;
  start: Date;
  end: Date;
  type: string;
  classId: string;
  icon?: string;
  reminder?: string;
}

interface ClassDetailsViewProps {
  classId: string;
  className: string;
  onClose: () => void;
}

export default function ClassDetailsView({ classId, className, onClose }: ClassDetailsViewProps) {
  const { currentUser } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'classroom' | 'history' | 'messaging' | 'calendar'>('classroom');
  const [students, setStudents] = useState<Student[]>([]);
  const [classTeachers, setClassTeachers] = useState<any[]>([]);
  const [events, setEvents] = useState<ClassEvent[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);
  const [allAvailableStudents, setAllAvailableStudents] = useState<Student[]>([]);
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [principalTeacher, setPrincipalTeacher] = useState<any>(null);
  const [isStudentDetailsModalOpen, setIsStudentDetailsModalOpen] = useState(false);
  const [studentModalView, setStudentModalView] = useState<'feedback' | 'report'>('feedback');
  const [studentFeedbackTab, setStudentFeedbackTab] = useState<'positive' | 'needs-work'>('positive');
  const [studentFeedbackHistory, setStudentFeedbackHistory] = useState<any[]>([]);
  
  const positiveSkills = [
    { id: 'on-task', name: 'Au travail', icon: '🎯', points: 1 },
    { id: 'helping-others', name: 'Aider les autres', icon: '🤝', points: 1 },
    { id: 'teamwork', name: 'Travail d\'équipe', icon: '👥', points: 1 },
    { id: 'participation', name: 'Participation', icon: '🙋‍♂️', points: 1 },
    { id: 'persistence', name: 'Persévérance', icon: '💪', points: 1 },
    { id: 'creativity', name: 'Créativité', icon: '🎨', points: 1 },
  ];

  const needsWorkSkills = [
    { id: 'off-task', name: 'Pas au travail', icon: '💤', points: -1 },
    { id: 'disrespect', name: 'Manque de respect', icon: '🚫', points: -1 },
    { id: 'no-homework', name: 'Devoirs non faits', icon: '📚', points: -1 },
    { id: 'talking-out-of-turn', name: 'Parle sans permission', icon: '🗣️', points: -1 },
  ];
  
  // Form states
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventIcon, setEventIcon] = useState('📅');
  const [eventReminder, setEventReminder] = useState('none');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceType, setResourceType] = useState<'text' | 'image' | 'video' | 'file' | 'recording'>('text');
  const [resourceUrl, setResourceUrl] = useState('');

  useEffect(() => {
    if (!classId) return;

    // Fetch students
    const studentsQuery = query(
      collection(db, 'users'), 
      where('role', '==', 'élève'),
      where('classe', '==', className)
    );
    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(studentsData.sort((a, b) => `${a.nom || ''} ${a.prenom || ''}`.trim().localeCompare(`${b.nom || ''} ${b.prenom || ''}`.trim())));
    });

    // Fetch events
    const eventsQuery = query(collection(db, 'events'), where('classId', '==', classId));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      setEvents(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          start: data.start.toDate(),
          end: data.end.toDate(),
        } as ClassEvent;
      }));
    });

    // Fetch resources (Class Story)
    const resourcesQuery = query(collection(db, 'resources'), where('classId', '==', classId));
    const unsubscribeResources = onSnapshot(resourcesQuery, (snapshot) => {
      setResources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      }));
    });

    // Fetch all students not in this class for the "Add Student" modal
    const allStudentsQuery = query(collection(db, 'users'), where('role', '==', 'élève'));
    const unsubscribeAllStudents = onSnapshot(allStudentsQuery, (snapshot) => {
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setAllAvailableStudents(all.filter(s => (s as any).classeId !== classId));
    });

    // Fetch class document to get teachers
    const unsubscribeClass = onSnapshot(doc(db, 'classes', classId), async (snapshot) => {
      if (snapshot.exists()) {
        const classData = snapshot.data();
        const teacherIds = [
          classData.professeur_principal_id,
          ...(classData.enseignants_ids || [])
        ].filter(Boolean);
        
        const teachersQuery = query(collection(db, 'users'), where('role', '==', 'enseignant'));
        const teachersSnapshot = await getDocs(teachersQuery);
        const allTeachers = teachersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        
        const filtered = allTeachers.filter(t => 
          teacherIds.includes(t.id)
        );
        
        setClassTeachers(filtered);
        
        const principal = filtered.find(t => t.id === classData.professeur_principal_id) || 
                         (filtered.length > 0 ? filtered[0] : null);
        setPrincipalTeacher(principal);
      }
    });

    // Fetch conversations related to this class (if any) or general for the teacher
    if (currentUser?.role === 'enseignant') {
      const convQuery = query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.id));
      const unsubscribeConv = onSnapshot(convQuery, (snapshot) => {
        setConversations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => {
        unsubscribeStudents();
        unsubscribeEvents();
        unsubscribeResources();
        unsubscribeConv();
      };
    }

    if (isStudentDetailsModalOpen && selectedStudent) {
      const feedbackQuery = query(
        collection(db, 'feedback'),
        where('studentId', '==', selectedStudent.id),
        where('classId', '==', classId)
      );
      const unsubscribeFeedback = onSnapshot(feedbackQuery, (snapshot) => {
        setStudentFeedbackHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => {
          const timeA = a.createdAt?.toMillis() || 0;
          const timeB = b.createdAt?.toMillis() || 0;
          return timeB - timeA;
        }));
      });
      return () => unsubscribeFeedback();
    }
  }, [isStudentDetailsModalOpen, selectedStudent, classId]);

  const handleAddStudentToClass = async () => {
    if (!selectedStudentToAdd) return;
    try {
      await updateDoc(doc(db, 'users', selectedStudentToAdd), {
        classeId: classId,
        classe: className
      });
      setIsAddStudentModalOpen(false);
      setSelectedStudentToAdd('');
    } catch (error) {
      console.error("Error adding student to class:", error);
    }
  };

  const handleGivePoint = async (studentId: string, points: number = 1, skillName?: string) => {
    try {
      await updateDoc(doc(db, 'users', studentId), {
        points: increment(points)
      });
      
      // If a skill was specified, we could log it to a 'feedback' collection
      if (skillName) {
        await addDoc(collection(db, 'feedback'), {
          studentId,
          classId,
          teacherId: currentUser?.id,
          skillName,
          points,
          createdAt: serverTimestamp()
        });
      }
      
      if (isStudentDetailsModalOpen) {
        setIsStudentDetailsModalOpen(false);
      }
    } catch (error) {
      console.error("Error giving point:", error);
    }
  };

  const handleStartChatWithStudent = async (studentId: string) => {
    if (!currentUser) return;
    
    // Check if conversation exists
    const q = query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.id));
    const snapshot = await getDocs(q);
    const existing = snapshot.docs.find(d => {
      const data = d.data();
      return !data.isGroup && data.participants.includes(studentId);
    });

    if (existing) {
      setSelectedConversationId(existing.id);
    } else {
      const newConv = await addDoc(collection(db, 'conversations'), {
        participants: [currentUser.id, studentId],
        isGroup: false,
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
        createdAt: serverTimestamp(),
        unreadCounts: {
          [currentUser.id]: 0,
          [studentId]: 0
        }
      });
      setSelectedConversationId(newConv.id);
    }
    setActiveTab('messaging');
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const start = new Date(`${eventDate}T${eventTime}`);
      const end = eventEndTime ? new Date(`${eventDate}T${eventEndTime}`) : new Date(start.getTime() + 3600000);
      await addDoc(collection(db, 'events'), {
        title: eventTitle,
        description: eventDescription,
        location: eventLocation,
        start,
        end,
        classId,
        icon: eventIcon,
        reminder: eventReminder,
        publisherId: currentUser.id,
        publisherName: `${currentUser.prenom} ${currentUser.nom}`,
        createdAt: serverTimestamp(),
        type: 'class_event'
      });
      setIsAddEventModalOpen(false);
      setEventTitle('');
      setEventDescription('');
      setEventLocation('');
      setEventDate('');
      setEventTime('');
      setEventEndTime('');
      setEventIcon('📅');
      setEventReminder('none');
    } catch (error) {
      console.error("Error adding event:", error);
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      await addDoc(collection(db, 'resources'), {
        title: resourceTitle,
        type: resourceType,
        url: (resourceType === 'text' || resourceType === 'recording') ? '' : resourceUrl,
        classId,
        publisherId: currentUser.id,
        publisherName: `${currentUser.prenom} ${currentUser.nom}`,
        createdAt: serverTimestamp()
      });
      setIsAddResourceModalOpen(false);
      setResourceTitle('');
      setResourceUrl('');
    } catch (error) {
      console.error("Error adding resource:", error);
    }
  };

  const renderClassroom = () => (
    <div className="space-y-8">
      {/* Teachers Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <GraduationCap className="text-indigo-600" size={20} />
          Enseignants ({classTeachers.length})
        </h3>
        <div className="flex flex-wrap gap-4">
          {classTeachers.map(teacher => (
            <div key={teacher.id} className="flex items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                {teacher.photo ? (
                  <img src={teacher.photo} alt="" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  teacher.prenom?.[0] || teacher.nom?.[0] || 'T'
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{teacher.prenom} {teacher.nom}</p>
                <p className="text-[10px] text-gray-500 uppercase font-medium">Enseignant</p>
              </div>
            </div>
          ))}
          {classTeachers.length === 0 && (
            <p className="text-sm text-gray-400 italic">Aucun enseignant assigné</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="text-indigo-600" size={20} />
            Élèves ({students.length})
          </h3>
          {currentUser?.role === 'enseignant' && (
            <button 
              onClick={() => setIsAddStudentModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
            >
              <UserPlus size={18} />
              Ajouter un élève
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {students.map(student => (
            <div 
              key={student.id} 
              onClick={() => {
                setSelectedStudent(student);
                setIsStudentDetailsModalOpen(true);
              }}
              className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative cursor-pointer"
            >
              <div className="relative mb-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-bold overflow-hidden border-4 border-white dark:border-gray-800 shadow-sm">
                  {student.photo ? (
                    <img src={student.photo} alt={student.prenom} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <img 
                      src={`https://robohash.org/${student.id}?set=set2&size=150x150`} 
                      alt={student.prenom} 
                      className="w-full h-full object-contain p-1" 
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
                <div className="absolute -top-1 -right-1 w-8 h-8 bg-green-500 text-white text-xs font-black rounded-full flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-md">
                  {student.points || 0}
                </div>
              </div>
              
              <h4 className="font-bold text-gray-900 dark:text-white truncate w-full text-sm mb-3">
                {student.prenom} {student.nom}
              </h4>
              
              {currentUser?.role === 'enseignant' && (
                <div className="flex items-center gap-2 mt-auto">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGivePoint(student.id);
                    }}
                    className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-xl transition-colors"
                    title="Donner un point"
                  >
                    <Plus size={18} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartChatWithStudent(student.id);
                    }}
                    className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl transition-colors"
                    title="Message"
                  >
                    <MessageCircle size={18} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
              {currentUser?.prenom?.[0]}
            </div>
            <button 
              onClick={() => { setResourceType('text'); setIsAddResourceModalOpen(true); }}
              className="flex-1 text-left px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Quoi de neuf dans votre classe ?
            </button>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'image', label: 'Photo', icon: ImageIcon, color: 'text-blue-500' },
              { id: 'video', label: 'Vidéo', icon: Video, color: 'text-red-500' },
              { id: 'file', label: 'Fichier', icon: FileText, color: 'text-purple-500' },
              { id: 'recording', label: 'Enregistrement', icon: MessageCircle, color: 'text-orange-500' },
            ].map(option => (
              <button
                key={option.id}
                onClick={() => { setResourceType(option.id as any); setIsAddResourceModalOpen(true); }}
                className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <option.icon className={option.color} size={24} />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {resources.map(resource => (
            <div key={resource.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                  {resource.publisherName?.[0]}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{resource.publisherName}</h4>
                  <p className="text-xs text-gray-500">{resource.createdAt ? format(resource.createdAt.toDate(), 'PPP à HH:mm', { locale: fr }) : ''}</p>
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-4">{resource.title}</p>
              {resource.type === 'image' && resource.url && (
                <img src={resource.url} alt="" className="w-full h-64 object-cover rounded-xl mb-4" referrerPolicy="no-referrer" />
              )}
              {resource.type === 'video' && resource.url && (
                <div className="aspect-video rounded-xl overflow-hidden mb-4">
                  <iframe src={resource.url} className="w-full h-full" allowFullScreen></iframe>
                </div>
              )}
              {resource.type === 'file' && resource.url && (
                <a 
                  href={resource.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 mb-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <FileText size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">Document partagé</p>
                    <p className="text-xs text-gray-500">Cliquez pour ouvrir</p>
                  </div>
                </a>
              )}
              {resource.type === 'recording' && (
                <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30 mb-4">
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                    <MessageCircle size={24} />
                  </div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Note vocale partagée</p>
                </div>
              )}
              <div className="flex items-center gap-4 pt-4 border-t border-gray-50 dark:border-gray-700">
                <button className="text-gray-500 hover:text-indigo-600 flex items-center gap-1 text-sm transition-colors">
                  <MessageCircle size={18} />
                  Commenter
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Évènements à venir</h3>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
          {events.filter(e => e.start >= new Date()).slice(0, 3).map(event => (
            <div key={event.id} className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400">
                <span className="text-[10px] font-bold uppercase">{format(event.start, 'MMM', { locale: fr })}</span>
                <span className="text-lg font-black">{format(event.start, 'dd')}</span>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-sm">{event.title}</h4>
                <p className="text-xs text-gray-500">{format(event.start, 'HH:mm')}</p>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-4">Aucun évènement prévu</p>
          )}
          <button 
            onClick={() => setActiveTab('calendar')}
            className="w-full py-2 text-indigo-600 text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
          >
            Voir tout le calendrier
          </button>
        </div>
      </div>
    </div>
  );

  const renderMessaging = () => {
    if (selectedConversationId) {
      return <Chat conversationId={selectedConversationId} onBack={() => setSelectedConversationId(null)} />;
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-[600px]">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Rechercher une conversation..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-200 dark:divide-gray-700">
          {conversations.map(conv => (
            <div 
              key={conv.id} 
              onClick={() => setSelectedConversationId(conv.id)}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                  {conv.isGroup ? <Users size={24} /> : <MessageCircle size={24} />}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{conv.groupName || 'Conversation'}</h4>
                  <p className="text-sm text-gray-500 line-clamp-1">{conv.lastMessage}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">{conv.lastMessageTime ? format(conv.lastMessageTime.toDate(), 'HH:mm') : ''}</p>
              </div>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
              <MessageCircle size={48} className="mb-4 opacity-20" />
              <p>Aucune conversation trouvée</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCalendar = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Calendrier de la classe</h3>
        {currentUser?.role === 'enseignant' && (
          <button 
            onClick={() => setIsAddEventModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
          >
            <Plus size={18} />
            Créer un évènement
          </button>
        )}
      </div>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 h-[600px] calendar-container">
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          culture="fr"
          messages={{
            next: "Suivant",
            previous: "Précédent",
            today: "Aujourd'hui",
            month: "Mois",
            week: "Semaine",
            day: "Jour",
            agenda: "Agenda"
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-50 dark:bg-gray-900 w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={onClose}
              className="flex items-center gap-2 p-2 -ml-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors group"
              aria-label="Retour"
            >
              <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium hidden sm:inline">Retour</span>
            </button>
            <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-indigo-600 items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-none">{className}</h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {principalTeacher ? (
                  <span className="flex items-center gap-1">
                    <User size={14} className="text-indigo-600" />
                    Prof. Principal: <span className="font-medium text-gray-900 dark:text-gray-200">{principalTeacher.prenom} {principalTeacher.nom}</span>
                  </span>
                ) : (
                  'Détails et gestion de la classe'
                )}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 px-6 border-b border-gray-200 dark:border-gray-700 shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex gap-8">
            {[
              { id: 'classroom', label: 'Salle de classe', icon: Users },
              { id: 'history', label: 'Histoire de classe', icon: History },
              { id: 'messaging', label: 'Messagerie', icon: MessageCircle },
              { id: 'calendar', label: 'Calendrier', icon: CalendarIcon },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-4 border-b-2 transition-all text-sm font-medium whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'classroom' && renderClassroom()}
          {activeTab === 'history' && renderHistory()}
          {activeTab === 'messaging' && renderMessaging()}
          {activeTab === 'calendar' && renderCalendar()}
        </div>
      </div>

      {/* Modals */}
      {isAddStudentModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Ajouter un élève à la classe</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sélectionner un élève</label>
                <select 
                  value={selectedStudentToAdd}
                  onChange={(e) => setSelectedStudentToAdd(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Choisir un élève...</option>
                  {allAvailableStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsAddStudentModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
                <button 
                  onClick={handleAddStudentToClass}
                  disabled={!selectedStudentToAdd}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddEventModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Créer un évènement</h3>
              <button onClick={() => setIsAddEventModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddEvent} className="p-6 space-y-4">
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-3xl shrink-0 border-2 border-indigo-100 dark:border-indigo-800">
                  {eventIcon}
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icône</label>
                  <select 
                    value={eventIcon}
                    onChange={(e) => setEventIcon(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="📅">📅 Calendrier</option>
                    <option value="🍎">🍎 École</option>
                    <option value="🎨">🎨 Art</option>
                    <option value="⚽">⚽ Sport</option>
                    <option value="🚌">🚌 Sortie</option>
                    <option value="🎭">🎭 Spectacle</option>
                    <option value="🧪">🧪 Science</option>
                    <option value="🎂">🎂 Anniversaire</option>
                    <option value="📚">📚 Lecture</option>
                    <option value="📝">📝 Examen</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titre de l'évènement</label>
                <input 
                  type="text" 
                  required 
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="ex: Sortie scolaire au zoo"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                  <input 
                    type="date" 
                    required 
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Heure de début</label>
                  <input 
                    type="time" 
                    required 
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Heure de fin</label>
                  <input 
                    type="time" 
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rappel pour les parents</label>
                <select 
                  value={eventReminder}
                  onChange={(e) => setEventReminder(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="none">Pas de rappel</option>
                  <option value="1_hour">1 heure avant</option>
                  <option value="1_day">1 jour avant</option>
                  <option value="2_days">2 jours avant</option>
                  <option value="1_week">1 semaine avant</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lieu</label>
                <input 
                  type="text" 
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="ex: Salle de classe, Cour de récréation"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea 
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  placeholder="Ajoutez des détails sur l'évènement..."
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsAddEventModalOpen(false)} className="px-6 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors">Annuler</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm">Créer l'évènement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddResourceModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {resourceType === 'image' && 'Partager une Photo'}
                {resourceType === 'video' && 'Partager une Vidéo'}
                {resourceType === 'file' && 'Partager un Fichier'}
                {resourceType === 'recording' && 'Partager un Enregistrement'}
                {resourceType === 'text' && 'Partager avec la classe'}
              </h3>
              <button onClick={() => setIsAddResourceModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddResource} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
                <textarea 
                  required 
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  placeholder="Quoi de neuf dans votre classe ?"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white resize-none h-32 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              
              {(resourceType === 'image' || resourceType === 'video' || resourceType === 'file') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL du {resourceType}</label>
                  <input 
                    type="url" 
                    required
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsAddResourceModalOpen(false)} className="px-6 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors">Annuler</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm">Partager</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isStudentDetailsModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="relative h-48 bg-gradient-to-br from-indigo-600 to-purple-700 p-8 flex items-end">
              <button 
                onClick={() => setIsStudentDetailsModalOpen(false)}
                className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors backdrop-blur-md"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-[2rem] bg-white p-1 shadow-xl">
                  <div className="w-full h-full rounded-[1.8rem] overflow-hidden bg-indigo-50 flex items-center justify-center">
                    {selectedStudent.photo ? (
                      <img src={selectedStudent.photo} alt={selectedStudent.prenom} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <img 
                        src={`https://robohash.org/${selectedStudent.id}?set=set2&size=200x200`} 
                        alt={selectedStudent.prenom} 
                        className="w-full h-full object-contain p-2" 
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                </div>
                <div className="text-white pb-2">
                  <h3 className="text-3xl font-black tracking-tight">{selectedStudent.prenom} {selectedStudent.nom}</h3>
                  <div className="flex items-center gap-2 mt-1 opacity-90">
                    <div className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold backdrop-blur-sm">
                      Élève • {className}
                    </div>
                    <div className="flex items-center gap-1 px-3 py-1 bg-green-400 text-green-900 rounded-full text-xs font-black">
                      <Award size={12} />
                      {selectedStudent.points || 0} points
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-gray-100 dark:border-gray-800 px-8 bg-gray-50/50 dark:bg-gray-900/50">
              {studentModalView === 'feedback' ? (
                <>
                  <button 
                    onClick={() => setStudentFeedbackTab('positive')}
                    className={`px-6 py-4 text-sm font-bold transition-all relative ${
                      studentFeedbackTab === 'positive' 
                        ? 'text-indigo-600 dark:text-indigo-400' 
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Positif
                    {studentFeedbackTab === 'positive' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-t-full" />}
                  </button>
                  <button 
                    onClick={() => setStudentFeedbackTab('needs-work')}
                    className={`px-6 py-4 text-sm font-bold transition-all relative ${
                      studentFeedbackTab === 'needs-work' 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    À travailler
                    {studentFeedbackTab === 'needs-work' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 dark:bg-red-400 rounded-t-full" />}
                  </button>
                </>
              ) : (
                <div className="px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 relative">
                  Historique des points
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-t-full" />
                </div>
              )}
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {studentModalView === 'feedback' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {(studentFeedbackTab === 'positive' ? positiveSkills : needsWorkSkills).map(skill => (
                    <button
                      key={skill.id}
                      onClick={() => handleGivePoint(selectedStudent.id, skill.points, skill.name)}
                      className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] border-2 transition-all duration-200 group ${
                        studentFeedbackTab === 'positive'
                          ? 'border-green-50 bg-green-50/30 hover:border-green-200 hover:bg-green-50 dark:border-green-900/10 dark:bg-green-900/5 dark:hover:border-green-900/30'
                          : 'border-red-50 bg-red-50/30 hover:border-red-200 hover:bg-red-50 dark:border-red-900/10 dark:bg-red-900/5 dark:hover:border-red-900/30'
                      }`}
                    >
                      <span className="text-4xl group-hover:scale-110 transition-transform duration-200">{skill.icon}</span>
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{skill.name}</p>
                        <p className={`text-xs font-black mt-1 ${
                          skill.points > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {skill.points > 0 ? `+${skill.points}` : skill.points}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {studentFeedbackHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <History size={32} />
                      </div>
                      <p className="text-gray-500">Aucun historique pour le moment</p>
                    </div>
                  ) : (
                    studentFeedbackHistory.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                            item.points > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {item.points > 0 ? '✨' : '⚠️'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">{item.skillName}</p>
                            <p className="text-xs text-gray-500">
                              {item.createdAt ? format(item.createdAt.toDate(), 'PPP à HH:mm', { locale: fr }) : 'À l\'instant'}
                            </p>
                          </div>
                        </div>
                        <div className={`font-black ${item.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.points > 0 ? `+${item.points}` : item.points}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    setIsStudentDetailsModalOpen(false);
                    handleStartChatWithStudent(selectedStudent.id);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                >
                  <MessageCircle size={18} />
                  Messages
                </button>
                <button 
                  onClick={() => setStudentModalView(studentModalView === 'feedback' ? 'report' : 'feedback')}
                  className={`flex items-center gap-2 px-5 py-2.5 border rounded-2xl text-sm font-bold transition-all shadow-sm ${
                    studentModalView === 'report'
                      ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <History size={18} />
                  {studentModalView === 'feedback' ? 'Rapport' : 'Donner feedback'}
                </button>
              </div>
              
              {currentUser?.role === 'enseignant' && (
                <button className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                  <Shield size={18} />
                  Connecter parents
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
