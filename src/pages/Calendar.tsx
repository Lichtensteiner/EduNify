import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Calendar as BigCalendar, dateFnsLocalizer, View, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { fr, enUS, es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Plus, List, Calendar as CalendarIcon, Download, X, Edit2, Trash2, Clock, MapPin, Users, Image as ImageIcon } from 'lucide-react';

const locales = {
  'fr': fr,
  'en': enUS,
  'es': es,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface AppEvent {
  id: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
  type: string;
  audience: string;
  publisherId: string;
  publisherName: string;
  imageUrl?: string;
  createdAt: any;
}

export default function Calendar() {
  const { currentUser } = useAuth();
  const { t, language } = useLanguage();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [calendarView, setCalendarView] = useState<View>(window.innerWidth < 768 ? Views.AGENDA : Views.MONTH);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [type, setType] = useState('meeting');
  const [audience, setAudience] = useState('all');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobile && calendarView === Views.MONTH) {
      setCalendarView(Views.AGENDA);
    } else if (!isMobile && calendarView === Views.AGENDA) {
      setCalendarView(Views.MONTH);
    }
  }, [isMobile, calendarView]);

  useEffect(() => {
    const q = query(collection(db, 'events'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData: AppEvent[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.start && data.end) {
          eventsData.push({
            id: doc.id,
            title: data.title,
            description: data.description || '',
            start: data.start.toDate(),
            end: data.end.toDate(),
            type: data.type || 'other',
            audience: data.audience || 'all',
            publisherId: data.publisherId,
            publisherName: data.publisherName,
            imageUrl: data.imageUrl || '',
            createdAt: data.createdAt,
          });
        }
      });
      setEvents(eventsData);
    }, (error) => {
      console.error('Error fetching events:', error);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenModal = (event?: AppEvent) => {
    if (event) {
      setSelectedEvent(event);
      setTitle(event.title);
      setDescription(event.description);
      setStartDate(format(event.start, 'yyyy-MM-dd'));
      setStartTime(format(event.start, 'HH:mm'));
      setEndDate(format(event.end, 'yyyy-MM-dd'));
      setEndTime(format(event.end, 'HH:mm'));
      setType(event.type);
      setAudience(event.audience);
      setImageUrl(event.imageUrl || '');
    } else {
      setSelectedEvent(null);
      setTitle('');
      setDescription('');
      const now = new Date();
      setStartDate(format(now, 'yyyy-MM-dd'));
      setStartTime(format(now, 'HH:mm'));
      const later = new Date(now.getTime() + 60 * 60 * 1000);
      setEndDate(format(later, 'yyyy-MM-dd'));
      setEndTime(format(later, 'HH:mm'));
      setType('meeting');
      setAudience('all');
      setImageUrl('');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      const startDateTime = new Date(`${startDate}T${startTime}`);
      const endDateTime = new Date(`${endDate}T${endTime}`);

      const eventData = {
        title,
        description,
        start: startDateTime,
        end: endDateTime,
        type,
        audience,
        imageUrl,
        publisherId: currentUser.id,
        publisherName: `${currentUser.prenom} ${currentUser.nom}`,
        updatedAt: serverTimestamp(),
      };

      if (selectedEvent) {
        await updateDoc(doc(db, 'events', selectedEvent.id), eventData);
        alert(t('event_updated_success'));
      } else {
        await addDoc(collection(db, 'events'), {
          ...eventData,
          createdAt: serverTimestamp(),
        });
        alert(t('event_created_success'));
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error saving event:', error);
      alert(t('error_saving_event'));
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (window.confirm(t('delete_event') + ' ?')) {
      try {
        await deleteDoc(doc(db, 'events', id));
        alert(t('event_deleted_success'));
        handleCloseModal();
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    }
  };

  const handleSyncCalendar = () => {
    // Generate ICS file
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Edu-Nify//Calendar//EN\n";
    
    events.forEach(event => {
      const formatDate = (date: Date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };
      
      icsContent += "BEGIN:VEVENT\n";
      icsContent += `UID:${event.id}@edu-nify.com\n`;
      icsContent += `DTSTAMP:${formatDate(new Date())}\n`;
      icsContent += `DTSTART:${formatDate(event.start)}\n`;
      icsContent += `DTEND:${formatDate(event.end)}\n`;
      icsContent += `SUMMARY:${event.title}\n`;
      icsContent += `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}\n`;
      icsContent += "END:VEVENT\n";
    });
    
    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', 'calendrier_scolaire.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(t('event_sync_success'));
  };

  const eventStyleGetter = (event: AppEvent) => {
    let backgroundColor = '#4f46e5'; // indigo-600
    if (event.type === 'exam') backgroundColor = '#dc2626'; // red-600
    if (event.type === 'activity') backgroundColor = '#16a34a'; // green-600
    
    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: '0',
        display: 'block'
      }
    };
  };

  const canEdit = (event: AppEvent) => {
    return currentUser?.role === 'admin' || currentUser?.id === event.publisherId;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('calendar')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('events')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'calendar' 
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <CalendarIcon size={16} />
              <span className="hidden sm:inline">{t('view_calendar')}</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <List size={16} />
              <span className="hidden sm:inline">{t('view_list')}</span>
            </button>
          </div>
          
          <button
            onClick={handleSyncCalendar}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm text-sm font-medium"
          >
            <Download size={16} />
            <span className="hidden sm:inline">{t('sync_calendar')}</span>
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
          >
            <Plus size={16} />
            {t('create_event')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-2 sm:p-6">
        {viewMode === 'calendar' ? (
          <div className="h-[500px] sm:h-[600px] lg:h-[750px] calendar-container">
            <style>{`
              .calendar-container .rbc-calendar {
                font-family: inherit;
              }
              .calendar-container .rbc-header {
                padding: 10px;
                font-weight: 600;
                color: #4b5563;
              }
              .dark .calendar-container .rbc-header {
                color: #9ca3af;
                border-bottom-color: #374151;
              }
              .calendar-container .rbc-month-view,
              .calendar-container .rbc-time-view,
              .calendar-container .rbc-agenda-view {
                border-color: #e5e7eb;
                border-radius: 0.5rem;
                overflow: hidden;
              }
              .dark .calendar-container .rbc-month-view,
              .dark .calendar-container .rbc-time-view,
              .dark .calendar-container .rbc-agenda-view {
                border-color: #374151;
              }
              .calendar-container .rbc-day-bg {
                border-color: #e5e7eb;
              }
              .dark .calendar-container .rbc-day-bg {
                border-color: #374151;
              }
              .calendar-container .rbc-off-range-bg {
                background-color: #f9fafb;
              }
              .dark .calendar-container .rbc-off-range-bg {
                background-color: #1f2937;
              }
              .calendar-container .rbc-today {
                background-color: #eff6ff;
              }
              .dark .calendar-container .rbc-today {
                background-color: #1e3a8a;
              }
              .calendar-container .rbc-event {
                padding: 2px 5px;
                font-size: 0.75rem;
              }
              @media (max-width: 640px) {
                .calendar-container .rbc-toolbar {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  gap: 0.5rem;
                }
                .calendar-container .rbc-toolbar .rbc-btn-group {
                  width: 100%;
                  display: flex;
                  justify-content: center;
                }
                .calendar-container .rbc-toolbar .rbc-btn-group button {
                  flex: 1;
                  padding: 4px 8px;
                  font-size: 0.7rem;
                }
                .calendar-container .rbc-toolbar-label {
                  font-size: 0.9rem;
                  font-weight: bold;
                  margin: 4px 0;
                }
                .calendar-container .rbc-header {
                  padding: 4px;
                  font-size: 0.7rem;
                }
              }
              .calendar-container .rbc-toolbar button {
                color: #374151;
                border-color: #d1d5db;
              }
              .calendar-container .rbc-toolbar button.rbc-active {
                background-color: #f3f4f6;
                box-shadow: none;
              }
              .dark .calendar-container .rbc-toolbar button {
                color: #d1d5db;
                border-color: #4b5563;
              }
              .dark .calendar-container .rbc-toolbar button:hover {
                background-color: #374151;
              }
              .dark .calendar-container .rbc-toolbar button.rbc-active {
                background-color: #4b5563;
                color: white;
              }
            `}</style>
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              view={calendarView}
              onView={setCalendarView}
              date={currentDate}
              onNavigate={setCurrentDate}
              onSelectEvent={(event) => handleOpenModal(event as AppEvent)}
              eventPropGetter={eventStyleGetter}
              culture={language === 'zh' || language === 'ja' ? 'en' : language}
              messages={{
                next: "▶",
                previous: "◀",
                today: t('today'),
                month: t('month'),
                week: t('week'),
                day: t('day'),
                agenda: t('view_list')
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {events.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <CalendarIcon size={48} className="mx-auto mb-4 opacity-20" />
                <p>{t('no_events')}</p>
              </div>
            ) : (
              events.sort((a, b) => a.start.getTime() - b.start.getTime()).map(event => (
                <div key={event.id} className="flex flex-col sm:flex-row gap-4 p-3 sm:p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex sm:flex-col items-center sm:justify-center gap-3 sm:gap-0 flex-shrink-0 sm:w-16 sm:h-16 p-2 sm:p-0 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    <span className="text-xs font-bold uppercase">{format(event.start, 'MMM')}</span>
                    <span className="text-lg sm:text-xl font-black">{format(event.start, 'dd')}</span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{event.title}</h3>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock size={14} />
                            <span>{format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users size={14} />
                            <span>{t(`audience_${event.audience}`)}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            event.type === 'exam' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            event.type === 'activity' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {t(`event_${event.type}`)}
                          </span>
                        </div>
                      </div>
                      
                      {canEdit(event) && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleOpenModal(event)} className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                            <Edit2 size={18} />
                          </button>
                          <button onClick={() => handleDeleteEvent(event.id)} className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {event.description && (
                      <p className="mt-3 text-gray-600 dark:text-gray-300 text-sm whitespace-pre-wrap">{event.description}</p>
                    )}
                    
                    {event.imageUrl && (
                      <div className="mt-4">
                        <img src={event.imageUrl} alt={event.title} className="max-h-48 rounded-lg object-cover" />
                      </div>
                    )}
                    
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                      {t('event_publisher')}: {event.publisherName}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedEvent ? t('edit_event') : t('create_event')}
              </h2>
              <button onClick={handleCloseModal} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEvent} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('event_title')} *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('event_date')} ({t('start_label')}) *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('event_time')} ({t('start_label')}) *
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('event_date')} ({t('end_label')}) *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('event_time')} ({t('end_label')}) *
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('event_type')}
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  >
                    <option value="meeting">{t('event_meeting')}</option>
                    <option value="activity">{t('event_activity')}</option>
                    <option value="exam">{t('event_exam')}</option>
                    <option value="other">{t('event_other')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('event_audience')}
                  </label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  >
                    <option value="all">{t('audience_all')}</option>
                    <option value="teachers">{t('audience_teachers')}</option>
                    <option value="parents">{t('audience_parents')}</option>
                    <option value="students">{t('audience_students')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('event_description')}
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('event_image_file')} (URL)
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <ImageIcon size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium transition-colors shadow-sm"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
