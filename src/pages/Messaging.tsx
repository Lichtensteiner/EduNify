import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, increment, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Search, Users, User, Megaphone, Send, Clock, Image, Video, Paperclip, Smile, ChevronRight, MessageCircle, MoreVertical, Trash2, LogOut, Eye, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Chat from './Chat';
import { createNotification, notifyAllUsers } from '../services/NotificationService';

interface Conversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: any;
  isGroup: boolean;
  groupName?: string;
  unreadCounts?: Record<string, number>;
  createdBy?: string;
}

interface MessagingProps {
  initialChatTargetId?: string;
  onClearTarget?: () => void;
}

export default function Messaging({ initialChatTargetId, onClearTarget }: MessagingProps) {
  const { currentUser } = useAuth();
  const { t, tData } = useLanguage();
  const { notifySuccess, notifyError } = useNotification();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [usersInfo, setUsersInfo] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModal, setActiveModal] = useState<'newGroup' | 'groupMessage' | 'announcement' | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupMessageText, setGroupMessageText] = useState('');
  const [announcementText, setAnnouncementText] = useState('');
  const [isSubmittingAnnouncement, setIsSubmittingAnnouncement] = useState(false);
  const [activeTab, setActiveTab] = useState<'conversations' | 'monitoring'>('conversations');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [viewingMembersGroup, setViewingMembersGroup] = useState<Conversation | null>(null);

  // Fetch all users for main list and modals
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      let usersData: any[] = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.id !== currentUser.id);
      
      // Parents can only message staff and admins
      if (currentUser.role === 'parent') {
        usersData = usersData.filter(u => ['admin', 'enseignant', 'personnel administratif'].includes(u.role));
      }
      
      // Sort users: online first, then alphabetically
      usersData.sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        const nameA = `${a.prenom || ''} ${a.nom || ''}`.trim().toLowerCase() || a.email?.split('@')[0].toLowerCase() || 'utilisateur';
        const nameB = `${b.prenom || ''} ${b.nom || ''}`.trim().toLowerCase() || b.email?.split('@')[0].toLowerCase() || 'utilisateur';
        return nameA.localeCompare(nameB);
      });
      
      setAllUsers(usersData);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Handle initialChatTargetId
  useEffect(() => {
    if (!initialChatTargetId || !currentUser) return;

    const startChat = async () => {
      // Check if conversation already exists in DB
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', currentUser.id)
      );
      const snapshot = await getDocs(q);
      const existingConv = snapshot.docs.find(doc => {
        const data = doc.data();
        return !data.isGroup && data.participants.includes(initialChatTargetId);
      });

      if (existingConv) {
        setSelectedConversationId(existingConv.id);
        window.history.pushState({ modal: 'chat' }, '');
      } else {
        // Create new conversation
        try {
          const newConvRef = await addDoc(collection(db, 'conversations'), {
            participants: [currentUser.id, initialChatTargetId],
            isGroup: false,
            lastMessage: '',
            lastMessageTime: serverTimestamp(),
            createdAt: serverTimestamp(),
            unreadCounts: {
              [currentUser.id]: 0,
              [initialChatTargetId]: 0
            }
          });
          setSelectedConversationId(newConvRef.id);
          window.history.pushState({ modal: 'chat' }, '');
        } catch (error) {
          console.error("Error creating conversation:", error);
        }
      }
      if (onClearTarget) onClearTarget();
    };

    startChat();
  }, [initialChatTargetId, currentUser, onClearTarget]);

  // Update usersInfo when allUsers changes
  useEffect(() => {
    if (allUsers.length > 0) {
      const infoMap: Record<string, any> = {};
      allUsers.forEach(u => {
        infoMap[u.id] = u;
      });
      setUsersInfo(prev => ({ ...prev, ...infoMap }));
    }
  }, [allUsers]);

  useEffect(() => {
    if (!currentUser) return;

    // Fetch conversations
    let q;
    if (currentUser.role === 'admin') {
      q = collection(db, 'conversations');
    } else {
      q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', currentUser.id)
      );
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data({ serverTimestamps: 'estimate' })
      })) as Conversation[];
      
      // Sort client-side to avoid requiring a composite index
      convos.sort((a, b) => {
        const timeA = a.lastMessageTime?.toMillis?.() || 0;
        const timeB = b.lastMessageTime?.toMillis?.() || 0;
        return timeB - timeA;
      });
      
      setConversations(convos);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const filteredUsers = allUsers.filter(user => {
    if (!searchQuery) return true;
    const fullName = `${user.prenom || ''} ${user.nom || ''}`.trim().toLowerCase() || user.email?.split('@')[0].toLowerCase() || 'utilisateur';
    return fullName.includes(searchQuery.toLowerCase());
  }).sort((a, b) => {
    const convA = conversations.find(c => !c.isGroup && c.participants.includes(a.id));
    const convB = conversations.find(c => !c.isGroup && c.participants.includes(b.id));
    
    const timeA = convA?.lastMessageTime?.toMillis?.() || 0;
    const timeB = convB?.lastMessageTime?.toMillis?.() || 0;
    
    if (timeA !== timeB) {
      return timeB - timeA; // Most recent first
    }
    
    if (a.status === 'online' && b.status !== 'online') return -1;
    if (a.status !== 'online' && b.status === 'online') return 1;
    
    const nameA = `${a.prenom || ''} ${a.nom || ''}`.trim().toLowerCase() || a.email?.split('@')[0].toLowerCase() || 'utilisateur';
    const nameB = `${b.prenom || ''} ${b.nom || ''}`.trim().toLowerCase() || b.email?.split('@')[0].toLowerCase() || 'utilisateur';
    return nameA.localeCompare(nameB);
  });

  const groupConversations = conversations.filter(conv => conv.isGroup && (!searchQuery || conv.groupName?.toLowerCase().includes(searchQuery.toLowerCase())));

  const studentConversations = conversations.filter(conv => {
    if (conv.isGroup) return false;
    // Check if all participants are students
    return conv.participants.every(pId => {
      const user = allUsers.find(u => u.id === pId) || (pId === currentUser?.id ? currentUser : null);
      return user?.role === 'élève';
    });
  });

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.modal === 'chat') {
        // Chat is open
      } else {
        setSelectedConversationId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleStartDirectChat = async (userId: string) => {
    if (!currentUser) return;
    
    // First check local state
    let existingConv = conversations.find(c => 
      !c.isGroup && c.participants.includes(userId)
    );

    // If not found locally, query the database to be absolutely sure
    if (!existingConv) {
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', currentUser.id)
      );
      const snapshot = await getDocs(q);
      existingConv = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation)).find(c => 
        !c.isGroup && c.participants.includes(userId)
      );
    }

    if (existingConv) {
      setSelectedConversationId(existingConv.id);
      window.history.pushState({ modal: 'chat' }, '');
    } else {
      try {
        const newConvRef = await addDoc(collection(db, 'conversations'), {
          participants: [currentUser.id, userId],
          isGroup: false,
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
          unreadCounts: {
            [currentUser.id]: 0,
            [userId]: 0
          }
        });
        setSelectedConversationId(newConvRef.id);
        window.history.pushState({ modal: 'chat' }, '');
      } catch (error) {
        console.error("Error creating conversation:", error);
      }
    }
    setActiveModal(null);
  };

  const handleBackFromChat = () => {
    setSelectedConversationId(null);
    if (window.history.state?.modal === 'chat') {
      window.history.back();
    }
  };

  const handleCreateGroup = async () => {
    if (!currentUser || !groupName.trim() || selectedUsers.length === 0) return;
    try {
      const unreadCounts: Record<string, number> = {};
      [currentUser.id, ...selectedUsers].forEach(id => {
        unreadCounts[id] = 0;
      });

      const newConvRef = await addDoc(collection(db, 'conversations'), {
        participants: [currentUser.id, ...selectedUsers],
        isGroup: true,
        groupName: groupName.trim(),
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
        createdAt: serverTimestamp(),
        unreadCounts,
        createdBy: currentUser.id
      });
      setSelectedConversationId(newConvRef.id);
      window.history.pushState({ modal: 'chat' }, '');
      setActiveModal(null);
      setGroupName('');
      setSelectedUsers([]);
    } catch (error) {
      console.error("Error creating group:", error);
    }
  };

  const handleSendBroadcast = async () => {
    if (!currentUser || !groupMessageText.trim() || selectedUsers.length === 0) return;
    
    try {
      for (const userId of selectedUsers) {
        let convId;
        let existingConv = conversations.find(c => 
          !c.isGroup && c.participants.includes(userId)
        );
        
        if (!existingConv) {
          const q = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUser.id)
          );
          const snapshot = await getDocs(q);
          existingConv = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation)).find(c => 
            !c.isGroup && c.participants.includes(userId)
          );
        }
        
        if (existingConv) {
          convId = existingConv.id;
        } else {
          const newConvRef = await addDoc(collection(db, 'conversations'), {
            participants: [currentUser.id, userId],
            isGroup: false,
            lastMessage: '',
            lastMessageTime: serverTimestamp(),
            createdAt: serverTimestamp(),
            unreadCounts: {
              [currentUser.id]: 0,
              [userId]: 0
            }
          });
          convId = newConvRef.id;
        }
        
        // Prefix broadcast with sender name if we want to follow the "real network" pattern
        const senderDisplayName = currentUser.prenom || currentUser.nom ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : currentUser.email?.split('@')[0] || t('user');
        
        await addDoc(collection(db, `conversations/${convId}/messages`), {
          senderId: currentUser.id,
          text: groupMessageText.trim(),
          createdAt: serverTimestamp()
        });
        
        await setDoc(doc(db, 'conversations', convId), {
          lastMessage: groupMessageText.trim(),
          lastMessageTime: serverTimestamp(),
          unreadCounts: {
            [userId]: increment(1)
          }
        }, { merge: true });

        // Notify recipient
        await createNotification({
          user_id: userId,
          title: `${t('new_message_from')} ${senderDisplayName}`,
          message: groupMessageText.trim(),
          type: 'info',
          targetTab: 'messaging'
        });
      }
      
      setActiveModal(null);
      setGroupMessageText('');
      setSelectedUsers([]);
      notifySuccess(t('broadcast_send_success'));
    } catch (error) {
      console.error("Error sending broadcast:", error);
      notifyError(t('broadcast_send_error') || "Error sending broadcast");
    }
  };

  const handleSendAnnouncement = async () => {
    if (!currentUser || !announcementText.trim()) return;
    
    setIsSubmittingAnnouncement(true);
    try {
      const senderName = currentUser.prenom || currentUser.nom ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : currentUser.email?.split('@')[0] || t('user');
      
      // Add announcement to a global collection
      await addDoc(collection(db, 'announcements'), {
        authorId: currentUser.id,
        authorName: senderName,
        text: announcementText.trim(),
        createdAt: serverTimestamp()
      });

      // Notify all users
      await notifyAllUsers(
        t('announcement'),
        announcementText.trim(),
        'info',
        'dashboard' // Or wherever announcements are shown
      );

      setActiveModal(null);
      setAnnouncementText('');
      notifySuccess(t('announcement_publish_success'));
    } catch (error) {
      console.error("Error sending announcement:", error);
      notifyError(t('announcement_publish_error') || "Error sending announcement");
    } finally {
      setIsSubmittingAnnouncement(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleLeaveGroup = async (conv: Conversation) => {
    if (!currentUser || !conv.isGroup) return;
    if (!window.confirm("Quitter ce groupe ?")) return;

    try {
      const convRef = doc(db, 'conversations', conv.id);
      const newParticipants = conv.participants.filter(id => id !== currentUser.id);
      const userName = `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() || currentUser.email?.split('@')[0] || "Un utilisateur";
      const leaveText = `${userName} a quitté le groupe`;
      
      if (newParticipants.length === 0) {
        await deleteDoc(convRef);
      } else {
        // Send a system action message to the conversation's message subcollection
        await addDoc(collection(db, `conversations/${conv.id}/messages`), {
          senderId: 'system',
          isSystem: true,
          text: leaveText,
          createdAt: serverTimestamp(),
          isDelivered: true
        });

        await updateDoc(convRef, {
          participants: newParticipants,
          lastMessage: leaveText,
          lastMessageTime: serverTimestamp()
        });
      }
      notifySuccess("Vous avez quitté le groupe.");
      setOpenMenuId(null);
    } catch (error) {
      console.error("Error leaving group:", error);
      notifyError("Erreur lors de la sortie du groupe.");
    }
  };

  const handleDeleteGroup = async (convId: string, conv?: Conversation) => {
    const isAllowed = currentUser && (
      currentUser.role === 'admin' ||
      currentUser.role === 'personnel administratif' ||
      currentUser.role === 'enseignant' ||
      conv?.createdBy === currentUser.id ||
      !conv?.createdBy
    );
    if (!currentUser || !isAllowed) return;
    if (!window.confirm("Supprimer ce groupe définitivement pour tous ?")) return;

    try {
      await deleteDoc(doc(db, 'conversations', convId));
      notifySuccess("Le groupe a été supprimé.");
      setOpenMenuId(null);
    } catch (error) {
      console.error("Error deleting group:", error);
      notifyError("Erreur lors de la suppression du groupe.");
    }
  };

  if (selectedConversationId) {
    return <Chat conversationId={selectedConversationId} onBack={handleBackFromChat} />;
  }

  return (
    <div className="max-w-5xl mx-auto h-[calc(100dvh-6rem)] sm:h-[calc(100vh-7rem)] flex flex-col p-2 sm:p-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white shrink-0">{t('messaging')}</h1>
          {currentUser?.role === 'admin' && (
            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('conversations')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'conversations' ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                {t('my_conversations')}
              </button>
              <button
                onClick={() => setActiveTab('monitoring')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'monitoring' ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                {t('student_monitoring')}
              </button>
            </div>
          )}
        </div>
        
        <div className="flex gap-1.5 sm:gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar py-1">
          <button 
            onClick={() => setActiveModal('newGroup')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs font-medium whitespace-nowrap shrink-0"
          >
            <Users size={14} className="sm:w-4 sm:h-4 text-indigo-600" />
            <span>{t('new_group')}</span>
          </button>
          <button 
            onClick={() => setActiveModal('groupMessage')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs font-medium whitespace-nowrap shrink-0"
          >
            <Send size={14} className="sm:w-4 sm:h-4 text-indigo-600" />
            <span>{t('group_message')}</span>
          </button>
          <button 
            onClick={() => setActiveModal('announcement')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition-colors text-xs font-medium whitespace-nowrap shrink-0"
          >
            <Megaphone size={14} className="sm:w-4 sm:h-4" />
            <span>{t('announcement')}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={t('search_user_group_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-200 dark:divide-gray-700">
          {activeTab === 'conversations' ? (
            <>
              {groupConversations.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800/50">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('groups')}
                  </div>
                  {groupConversations.map((conv) => (
                    <div 
                      key={conv.id} 
                      className="p-4 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer flex items-center justify-between group relative"
                      onClick={() => {
                        setSelectedConversationId(conv.id);
                        window.history.pushState({ modal: 'chat' }, '');
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-lg shrink-0 overflow-hidden">
                            <Users size={24} />
                          </div>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {conv.groupName}
                          </h3>
                          <p className={`text-sm dark:text-gray-400 line-clamp-1 ${conv.unreadCounts?.[currentUser.id] ? 'text-gray-900 dark:text-gray-200 font-semibold' : 'text-gray-500'}`}>
                            {conv.isGroup && conv.lastMessage && conv.lastMessage.includes(': ') ? (
                              <>
                                <span className="font-bold text-gray-700 dark:text-gray-300">{conv.lastMessage.split(': ')[0]}: </span>
                                {conv.lastMessage.split(': ').slice(1).join(': ')}
                              </>
                            ) : (
                              conv.lastMessage || <span className="italic">{t('new_conversation')}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs text-gray-400">
                            {conv.lastMessageTime ? format(conv.lastMessageTime.toDate(), 'HH:mm', { locale: fr }) : ''}
                          </span>
                          {conv.unreadCounts?.[currentUser.id] ? (
                            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                              {conv.unreadCounts[currentUser.id]}
                            </span>
                          ) : null}
                        </div>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === conv.id ? null : conv.id);
                            }}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-500 transition-colors"
                          >
                            <MoreVertical size={18} />
                          </button>
                          {openMenuId === conv.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingMembersGroup(conv);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                              >
                                <Eye size={16} />
                                Voir les membres
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLeaveGroup(conv);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                              >
                                <LogOut size={16} />
                                Quitter le groupe
                              </button>
                               {(currentUser?.role === 'admin' ||
                                 currentUser?.role === 'personnel administratif' ||
                                 currentUser?.role === 'enseignant' ||
                                 conv.createdBy === currentUser?.id ||
                                 !conv.createdBy) && (
                                 <button
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     handleDeleteGroup(conv.id, conv);
                                   }}
                                   className="w-full text-left px-4 py-2 text-sm text-red-600 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                 >
                                   <Trash2 size={16} />
                                   Supprimer le groupe
                                 </button>
                               )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50">
                {t('users')}
              </div>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  // Find if there is an existing conversation to show last message
                  const existingConv = conversations.find(c => !c.isGroup && c.participants.includes(user.id) && c.participants.includes(currentUser.id));
                  
                  return (
                    <div 
                      key={user.id} 
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer flex items-center justify-between group"
                      onClick={() => handleStartDirectChat(user.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-lg shrink-0 overflow-hidden">
                            {user.photo ? (
                              <img src={user.photo} alt={user.nom} className="w-full h-full object-cover" />
                            ) : (
                              user.prenom || user.nom ? `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}` : user.email?.[0] || 'U'
                            )}
                          </div>
                          {user.status === 'online' && (
                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                          )}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {user.prenom || user.nom ? `${user.prenom || ''} ${user.nom || ''}`.trim() : user.email?.split('@')[0] || t('user')}
                          </h3>
                          <p className={`text-sm line-clamp-1 ${existingConv?.unreadCounts?.[currentUser?.id] ? 'text-gray-900 dark:text-gray-200 font-semibold italic' : 'text-gray-500 dark:text-gray-400'}`}>
                            {existingConv?.lastMessage || <span className="italic">{t('new_conversation')}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {existingConv?.lastMessageTime && (
                          <span className="text-xs text-gray-400">
                            {format(existingConv.lastMessageTime.toDate(), 'HH:mm', { locale: fr })}
                          </span>
                        )}
                        {existingConv?.unreadCounts?.[currentUser.id] ? (
                          <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {existingConv.unreadCounts[currentUser.id]}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center h-full">
                  <MessageCircle size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
                  <p>{t('no_user_found')}</p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800/50">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('student_conversations')}
              </div>
              {studentConversations.length > 0 ? (
                studentConversations.map((conv) => {
                  const participants = conv.participants.map(pId => {
                    const user = allUsers.find(u => u.id === pId) || (pId === currentUser?.id ? currentUser : null);
                    return user ? `${user.prenom} ${user.nom}` : t('unknown');
                  }).join(' & ');

                  return (
                    <div 
                      key={conv.id} 
                      className="p-4 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer flex items-center justify-between group"
                      onClick={() => {
                        setSelectedConversationId(conv.id);
                        window.history.pushState({ modal: 'chat' }, '');
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-lg shrink-0 overflow-hidden">
                            <MessageCircle size={24} />
                          </div>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {participants}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                            {conv.lastMessage || <span className="italic">{t('no_message')}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-gray-400">
                          {conv.lastMessageTime ? format(conv.lastMessageTime.toDate(), 'HH:mm', { locale: fr }) : ''}
                        </span>
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase font-bold">
                          {t('monitoring')}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center h-full">
                  <MessageCircle size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
                  <p>{t('no_student_conversations')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {activeModal === 'newGroup' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users size={20} className="text-indigo-600" />
                {t('new_group')}
              </h2>
              <button onClick={() => { setActiveModal(null); setSelectedUsers([]); setGroupName(''); }} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                &times;
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
              <input
                type="text"
                placeholder={t('group_name')}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 mb-4"
              />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('select_participants')}</p>
              <div className="space-y-2">
                {allUsers.map(user => (
                  <label 
                    key={user.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors"
                  >
                    <input 
                      type="checkbox" 
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold overflow-hidden shrink-0 uppercase">
                      {user.photo ? (
                        <img src={user.photo} alt={user.nom} className="w-full h-full object-cover" />
                      ) : (
                        user.prenom || user.nom ? `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}` : user.email?.[0] || 'U'
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {user.prenom || user.nom ? `${user.prenom || ''} ${user.nom || ''}`.trim() : user.email?.split('@')[0] || t('user')}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{tData(user.role)}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => { setActiveModal(null); setSelectedUsers([]); setGroupName(''); }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedUsers.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {t('create_group')}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'groupMessage' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Send size={20} className="text-indigo-600" />
                {t('group_message_diffusion')}
              </h2>
              <button onClick={() => { setActiveModal(null); setSelectedUsers([]); setGroupMessageText(''); }} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                &times;
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
              <textarea
                placeholder={t('write_message_placeholder')}
                value={groupMessageText}
                onChange={(e) => setGroupMessageText(e.target.value)}
                className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none mb-4"
              />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('select_recipients')}</p>
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                {allUsers.map(user => (
                  <label 
                    key={user.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors"
                  >
                    <input 
                      type="checkbox" 
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold overflow-hidden shrink-0 text-xs uppercase">
                      {user.photo ? (
                        <img src={user.photo} alt={user.nom} className="w-full h-full object-cover" />
                      ) : (
                        user.prenom || user.nom ? `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}` : user.email?.[0] || 'U'
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900 dark:text-white">
                        {user.prenom || user.nom ? `${user.prenom || ''} ${user.nom || ''}`.trim() : user.email?.split('@')[0] || t('user')}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => { setActiveModal(null); setSelectedUsers([]); setGroupMessageText(''); }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSendBroadcast}
                disabled={!groupMessageText.trim() || selectedUsers.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Send size={18} />
                {t('send_to_n_people').replace('{{count}}', selectedUsers.length.toString())}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'announcement' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Megaphone size={20} className="text-indigo-600" />
                {t('make_announcement')}
              </h2>
              <button onClick={() => setActiveModal(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                &times;
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <textarea
                placeholder={t('announcement_text_placeholder')}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none mb-4"
              />
              <div className="flex items-center gap-2 mb-4">
                <button type="button" className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors" title={t('image')}>
                  <Image size={20} />
                </button>
                <button type="button" className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors" title={t('video')}>
                  <Video size={20} />
                </button>
                <button type="button" className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors" title={t('file')}>
                  <Paperclip size={20} />
                </button>
                <button type="button" className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors" title="Emojis">
                  <Smile size={20} />
                </button>
                <div className="flex-1"></div>
                <button type="button" className="flex items-center gap-2 p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm font-medium" title={t('schedule')}>
                  <Clock size={18} />
                  <span>{t('schedule')}</span>
                </button>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-3 rounded-lg text-sm">
                {t('announcement_visibility_notice')}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSendAnnouncement}
                disabled={!announcementText.trim() || isSubmittingAnnouncement}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Send size={18} />
                {isSubmittingAnnouncement ? t('sending') : t('publish_announcement')}
              </button>
            </div>
          </div>
        </div>
      )}
      {viewingMembersGroup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white">Membres du groupe</h3>
              <button onClick={() => setViewingMembersGroup(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
              {viewingMembersGroup.participants.map((pId) => {
                const user = pId === currentUser?.id ? currentUser : usersInfo[pId];
                if (!user) return (
                  <div key={pId} className="p-3 text-xs text-gray-500 italic">
                    ID: {pId} (Chargement...)
                  </div>
                );
                return (
                  <div key={pId} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold overflow-hidden shadow-sm uppercase">
                      {user.photo ? (
                        <img src={user.photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        `${user.prenom?.[0] || ''}${user.nom?.[0] || user.email?.[0] || 'U'}`
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold dark:text-white">{user.prenom} {user.nom}</p>
                      <p className="text-[10px] text-gray-500 uppercase font-black">{tData(user.role)}</p>
                    </div>
                    {pId === currentUser?.id && (
                      <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg uppercase">Moi</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
