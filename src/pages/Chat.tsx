import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { collection, query, where, getDocs, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Image, Video, Paperclip, Smile, Send, Clock, Camera, MoreVertical, X, Users, User, ChevronDown, Trash2, Ban } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { createNotification } from '../services/NotificationService';

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'file';
  scheduledFor?: any;
  isDelivered?: boolean;
  isDeleted?: boolean;
}

interface ChatProps {
  conversationId: string;
  onBack: () => void;
}

export default function Chat({ conversationId, onBack }: ChatProps) {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | 'file' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [participantsMap, setParticipantsMap] = useState<Record<string, any>>({});
  const [conversationData, setConversationData] = useState<any>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      // Close message menu if clicked outside
      if (!(event.target as Element).closest('.message-menu-container')) {
        setActiveMessageMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm("Supprimer ce message pour tout le monde ?")) return;
    
    try {
      await updateDoc(doc(db, `conversations/${conversationId}/messages`, messageId), {
        isDeleted: true,
        text: '',
        mediaUrl: null,
        mediaType: null,
        updatedAt: serverTimestamp()
      });
      setActiveMessageMenu(null);
    } catch (error) {
      console.error("Erreur lors de la suppression du message:", error);
    }
  };

  const handleClearChat = async () => {
    if (!currentUser || !conversationId) return;
    if (!window.confirm("Voulez-vous vraiment supprimer TOUS les messages de cette conversation pour TOUT LE MONDE ? Cette action est irréversible.")) return;

    try {
      const messagesRef = collection(db, `conversations/${conversationId}/messages`);
      const snapshot = await getDocs(messagesRef);
      
      const deletePromises = snapshot.docs.map(messageDoc => 
        updateDoc(doc(db, `conversations/${conversationId}/messages`, messageDoc.id), {
          isDeleted: true,
          text: '',
          mediaUrl: null,
          mediaType: null,
          updatedAt: serverTimestamp()
        })
      );

      await Promise.all(deletePromises);
      
      // Update last message in conversation
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: "Messages effacés",
        lastMessageTime: serverTimestamp()
      });

      setShowOptions(false);
      alert("La conversation a été vidée.");
    } catch (error) {
      console.error("Error clearing chat:", error);
      alert("Une erreur est survenue lors de la suppression des messages.");
    }
  };

  const onEmojiClick = (emojiObject: any) => {
    setNewMessage(prev => prev + emojiObject.emoji);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
      scrollToBottom();
    }
  };

  useEffect(() => {
    if (!conversationId || !currentUser) return;

    let unsubscribeUser: any;

    // Listen to conversation details
    const unsubscribeConv = onSnapshot(doc(db, 'conversations', conversationId), async (convDoc) => {
      if (convDoc.exists()) {
        const data = convDoc.data();
        setConversationData(data);
        
        // Reset unread count if it's greater than 0
        if (data.unreadCounts && data.unreadCounts[currentUser.id] > 0) {
          try {
            await setDoc(doc(db, 'conversations', conversationId), {
              unreadCounts: {
                [currentUser.id]: 0
              }
            }, { merge: true });
          } catch (error) {
            console.error("Error resetting unread count:", error);
          }
        }
        
        if (!data.isGroup) {
          const otherParticipantId = data.participants.find((id: string) => id !== currentUser.id);
          
          if (otherParticipantId && !unsubscribeUser) {
            // Listen to other user's profile for real-time status
            unsubscribeUser = onSnapshot(doc(db, 'users', otherParticipantId), (userDoc) => {
              if (userDoc.exists()) {
                setOtherUser({ id: userDoc.id, ...userDoc.data() });
              }
            });
          }
        } else {
          // Fetch all participants for group chat efficiently
          const fetchParticipants = async () => {
            try {
              const missingIds = data.participants.filter((pId: string) => pId !== currentUser.id && !participantsMap[pId]);
              
              if (missingIds.length === 0) return;

              // Batch IDs in groups of 10 for 'in' query (Firestore limit)
              const batches = [];
              for (let i = 0; i < missingIds.length; i += 10) {
                batches.push(missingIds.slice(i, i + 10));
              }

              const newMap: Record<string, any> = { ...participantsMap };
              let changed = false;

              for (const batch of batches) {
                const q = query(collection(db, 'users'), where('__name__', 'in', batch));
                const snap = await getDocs(q);
                snap.docs.forEach(doc => {
                  newMap[doc.id] = { id: doc.id, ...doc.data() };
                  changed = true;
                });
              }

              if (changed) {
                setParticipantsMap(prev => ({ ...prev, ...newMap }));
              }
            } catch (error) {
              console.error("Error fetching participants:", error);
            }
          };
          fetchParticipants();
        }
      }
    });

    const q = query(
      collection(db, `conversations/${conversationId}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data({ serverTimestamps: 'estimate' })
      })) as Message[];
      
      // Sort locally to ensure estimated timestamps are at the bottom
      msgs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeA - timeB;
      });

      setMessages(msgs);
      scrollToBottom();
    });

    return () => {
      unsubscribeMessages();
      unsubscribeConv();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, [conversationId, currentUser]);

  useEffect(() => {
    if (!conversationId || !currentUser || messages.length === 0) return;

    // Interval to check for scheduled messages that need to be "sent" (update lastMessage)
    const checkScheduledInterval = setInterval(() => {
      const now = new Date();
      
      messages.forEach(async (msg) => {
        if (msg.scheduledFor && msg.senderId === currentUser.id) {
          const scheduledTime = msg.scheduledFor.toDate();
          if (scheduledTime <= now && !msg.isDelivered) {
            // Mark as delivered and update conversation lastMessage
            try {
              await updateDoc(doc(db, `conversations/${conversationId}/messages`, msg.id), {
                isDelivered: true
              });
              
              let lastMsgText = msg.text;
              if (!lastMsgText && msg.mediaType) {
                if (msg.mediaType === 'image') lastMsgText = `📷 ${t('image')}`;
                else if (msg.mediaType === 'video') lastMsgText = `🎥 ${t('video')}`;
                else lastMsgText = `📎 ${t('file')}`;
              }

              const updateData: any = {
                lastMessage: lastMsgText,
                lastMessageTime: serverTimestamp(),
                unreadCounts: {}
              };

              if (conversationData && conversationData.participants) {
                conversationData.participants.forEach((pId: string) => {
                  if (pId !== currentUser.id) {
                    updateData.unreadCounts[pId] = increment(1);
                  }
                });
              }

              await setDoc(doc(db, 'conversations', conversationId), updateData, { merge: true });
            } catch (error) {
              console.error("Error updating scheduled message:", error);
            }
          }
        }
      });
    }, 10000); // Check every 10 seconds

    return () => {
      clearInterval(checkScheduledInterval);
    };
  }, [conversationId, currentUser, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setFileType(type);

    if (type === 'image' || type === 'video') {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(file.name);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setFileType(null);
    setUploadProgress(0);
  };

  const toggleMute = async () => {
    if (!conversationId || !currentUser) return;
    const isMuted = conversationData?.mutedBy?.includes(currentUser.id);
    try {
      const convRef = doc(db, 'conversations', conversationId);
      if (isMuted) {
        await updateDoc(convRef, {
          mutedBy: conversationData.mutedBy.filter((id: string) => id !== currentUser.id)
        });
      } else {
        await updateDoc(convRef, {
          mutedBy: [...(conversationData.mutedBy || []), currentUser.id]
        });
      }
      setShowOptions(false);
    } catch (error) {
      console.error("Error toggling mute:", error);
    }
  };

  const handleBlockUser = async () => {
    if (!otherUser || !currentUser) return;
    const isAlreadyBlocked = currentUser.blockedUsers?.includes(otherUser.id);
    const confirmMsg = isAlreadyBlocked 
      ? `Débloquer ${otherUser.prenom} ${otherUser.nom} ?`
      : `Bloquer ${otherUser.prenom} ${otherUser.nom} ?`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const currentBlocked = currentUser.blockedUsers || [];
      const userRef = doc(db, 'users', currentUser.id);
      
      if (isAlreadyBlocked) {
        await updateDoc(userRef, {
          blockedUsers: currentBlocked.filter((id: string) => id !== otherUser.id)
        });
      } else {
        await updateDoc(userRef, {
          blockedUsers: [...currentBlocked, otherUser.id]
        });
      }
      setShowOptions(false);
    } catch (error) {
      console.error("Error blocking user:", error);
    }
  };

  const handleLeaveGroup = async () => {
    if (!conversationId || !currentUser || !conversationData?.isGroup) return;
    if (!window.confirm("Quitter ce groupe ? Vous ne pourrez plus voir les nouveaux messages.")) return;

    try {
      const convRef = doc(db, 'conversations', conversationId);
      const newParticipants = conversationData.participants.filter((id: string) => id !== currentUser.id);
      
      if (newParticipants.length === 0) {
        // Delete conversation if no one left
        // (In a real app, maybe mark as inactive)
      } else {
        await updateDoc(convRef, {
          participants: newParticipants,
          lastMessage: `${currentUser.prenom || 'Un utilisateur'} a quitté le groupe`,
          lastMessageTime: serverTimestamp()
        });
      }
      setShowOptions(false);
      onBack();
    } catch (error) {
      console.error("Error leaving group:", error);
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversationId || !currentUser) return;
    if (!window.confirm("Supprimer cette conversation définitivement ?")) return;

    try {
      // In a real app we might just hide it for this user
      // For this implementation, we'll remove the user from participants if it's 1v1
      const convRef = doc(db, 'conversations', conversationId);
      if (!conversationData.isGroup) {
        const newParticipants = conversationData.participants.filter((id: string) => id !== currentUser.id);
        await updateDoc(convRef, {
          participants: newParticipants
        });
      }
      setShowOptions(false);
      onBack();
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !currentUser || !conversationId) return;

    if (currentUser.chatBlocked || (!conversationData?.isGroup && currentUser.blockedUsers?.includes(otherUser?.id))) {
      alert(currentUser.chatBlocked ? t('messaging_blocked_notice') : "Vous avez bloqué cet utilisateur.");
      return;
    }

    setIsSubmitting(true);
    try {
      let mediaUrl = null;
      let finalMediaType = null;

      if (selectedFile) {
        const storageRef = ref(storage, `uploads/messages/${conversationId}/${Date.now()}_${selectedFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, selectedFile);

        mediaUrl = await new Promise<string>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              console.error('Upload error:', error);
              reject(error);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            }
          );
        });
        finalMediaType = fileType;
      }

      let scheduledTimestamp = null;
      if (scheduledDate && scheduledTime) {
        const dateObj = new Date(`${scheduledDate}T${scheduledTime}`);
        if (dateObj > new Date()) {
          scheduledTimestamp = dateObj;
        }
      }

      await addDoc(collection(db, `conversations/${conversationId}/messages`), {
        senderId: currentUser.id,
        text: newMessage.trim(),
        mediaUrl,
        mediaType: finalMediaType,
        createdAt: serverTimestamp(),
        scheduledFor: scheduledTimestamp,
        isDelivered: !scheduledTimestamp
      });
      
      if (!scheduledTimestamp) {
        let lastMsgText = newMessage.trim();
        if (!lastMsgText && finalMediaType) {
          if (finalMediaType === 'image') lastMsgText = `📷 ${t('image')}`;
          else if (finalMediaType === 'video') lastMsgText = `🎥 ${t('video')}`;
          else lastMsgText = `📎 ${t('file')}`;
        }

        const senderName = currentUser.prenom || currentUser.nom ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : currentUser.email?.split('@')[0] || t('user');
        
        // For groups, prefix last message with sender name
        const displayLastMsg = conversationData?.isGroup ? `${senderName}: ${lastMsgText}` : lastMsgText;

        const updateData: any = {
          lastMessage: displayLastMsg,
          lastMessageTime: serverTimestamp(),
          unreadCounts: {}
        };

        if (conversationData && conversationData.participants) {
          conversationData.participants.forEach((pId: string) => {
            if (pId !== currentUser.id) {
              updateData.unreadCounts[pId] = increment(1);
            }
          });
        }

        await setDoc(doc(db, 'conversations', conversationId), updateData, { merge: true });
        
        // Notify other participants
        if (conversationData && conversationData.participants) {
          const senderName = currentUser.prenom || currentUser.nom ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : currentUser.email?.split('@')[0] || t('user');
          
          const notificationPromises = conversationData.participants
            .filter((pId: string) => pId !== currentUser.id)
            .map((pId: string) => createNotification({
              user_id: pId,
              title: conversationData.isGroup ? `${t('new_message_in')} ${conversationData.groupName}` : `${t('new_message_from')} ${senderName}`,
              message: lastMsgText,
              type: 'info',
              targetTab: 'messaging'
            }));
          
          await Promise.all(notificationPromises);
        }
      }
      
      setNewMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      clearFile();
      setScheduledDate('');
      setScheduledTime('');
      setShowScheduleModal(false);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-6rem)] sm:h-[calc(100vh-7rem)] bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold overflow-hidden">
              {conversationData?.isGroup ? (
                <Users size={20} />
              ) : otherUser?.photo ? (
                <img src={otherUser.photo} alt={otherUser.nom} className="w-full h-full object-cover" />
              ) : (
                otherUser ? `${otherUser.prenom?.[0]}${otherUser.nom?.[0]}` : <User size={20} />
              )}
            </div>
            {!conversationData?.isGroup && otherUser?.status === 'online' && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
            )}
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">
              {conversationData?.isGroup 
                ? conversationData.groupName 
                : (otherUser ? `${otherUser.prenom} ${otherUser.nom}` : t('loading'))}
            </h2>
            {!conversationData?.isGroup && otherUser && (
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                {otherUser.status === 'online' ? (
                  <span className="text-green-500 font-medium">{t('online_status')}</span>
                ) : (
                  <span>
                    {t('online_status')} {otherUser.lastSeen ? t('online_at').replace('{{date}}', format(otherUser.lastSeen.toDate(), 'dd/MM')).replace('{{time}}', format(otherUser.lastSeen.toDate(), 'HH:mm')) : t('recently')}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowOptions(!showOptions)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <MoreVertical size={20} />
          </button>
          
          {showOptions && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-50 py-1">
              <button 
                onClick={() => { setShowOptions(false); setShowGroupMembers(true); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <Users size={16} />
                {conversationData?.isGroup ? "Membres du groupe" : t('view_profile')}
              </button>
              
              <button 
                onClick={toggleMute}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <Smile size={16} />
                {conversationData?.mutedBy?.includes(currentUser?.id) ? "Rétablir les sons" : "Sourdine"}
              </button>

              <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
              
              {conversationData?.isGroup ? (
                <button 
                  onClick={handleLeaveGroup}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                >
                  <ArrowLeft size={16} />
                  Quitter le groupe
                </button>
              ) : (
                <>
                  <button 
                    onClick={handleBlockUser}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                  >
                    <Ban size={16} />
                    {currentUser?.blockedUsers?.includes(otherUser?.id) ? "Débloquer" : t('block_user')}
                  </button>
                  <button 
                    onClick={handleDeleteConversation}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                  >
                    <Trash2 size={16} />
                    Supprimer la conversation
                  </button>
                </>
              )}

              {(currentUser?.role === 'admin' || currentUser?.role === 'enseignant') && (
                <>
                  <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
                  <button 
                    onClick={handleClearChat}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                  >
                    <Trash2 size={16} />
                    Vider les messages (Admin)
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Group Members Modal / Sidebar Overlay */}
      {showGroupMembers && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white">Membres</h3>
              <button onClick={() => setShowGroupMembers(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
              {conversationData?.participants.map((pId: string) => {
                const user = pId === currentUser?.id ? currentUser : participantsMap[pId];
                if (!user) return null;
                return (
                  <div key={pId} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold overflow-hidden shadow-sm">
                      {user.photo ? (
                        <img src={user.photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        `${user.prenom?.[0] || ''}${user.nom?.[0] || 'U'}`
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold dark:text-white">{user.prenom} {user.nom}</p>
                      <p className="text-[10px] text-gray-500 uppercase font-black">{user.role}</p>
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

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900 custom-scrollbar">
        {messages.map((msg) => {
          const isMine = msg.senderId === currentUser?.id;
          const isScheduled = msg.scheduledFor && msg.scheduledFor.toDate() > new Date() && !msg.isDelivered;
          
          if (isScheduled && !isMine) return null;

          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-4`}>
              {!isMine && conversationData?.isGroup && (
                <div className="flex-shrink-0 mr-2 mt-auto mb-1">
                  {participantsMap[msg.senderId]?.photo ? (
                    <img 
                      src={participantsMap[msg.senderId].photo} 
                      alt="" 
                      className="w-8 h-8 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-medium text-xs uppercase">
                      {participantsMap[msg.senderId]?.prenom?.[0] || participantsMap[msg.senderId]?.email?.[0] || 'U'}
                    </div>
                  )}
                </div>
              )}
              <div className={`max-w-[75%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                {!isMine && conversationData?.isGroup && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 mb-1 font-medium">
                    {participantsMap[msg.senderId]?.prenom || participantsMap[msg.senderId]?.nom 
                      ? `${participantsMap[msg.senderId]?.prenom || ''} ${participantsMap[msg.senderId]?.nom || ''}`.trim() 
                      : participantsMap[msg.senderId]?.email?.split('@')[0] || t('user')}
                  </span>
                )}
                <div className={`relative group rounded-2xl px-4 py-2 ${
                  isMine 
                    ? (isScheduled ? 'bg-indigo-400 text-white rounded-br-none border border-indigo-500 border-dashed' : 'bg-indigo-600 text-white rounded-br-none') 
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-none'
                }`}>
                  {((isMine && !msg.isDeleted) || (currentUser?.role === 'admin' || currentUser?.role === 'enseignant')) && !msg.isDeleted && (
                    <div className="message-menu-container absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id)}
                        className={`p-1 rounded-full bg-black/10 hover:bg-black/20 text-white transition-colors`}
                      >
                        <ChevronDown size={14} />
                      </button>
                      
                      {activeMessageMenu === msg.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
                            <button 
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 size={16} />
                              {isMine ? t('delete_for_everyone') : "Supprimer (Modération)"}
                            </button>
                        </div>
                      )}
                    </div>
                  )}

                  {msg.isDeleted ? (
                    <div className="flex items-center gap-2 text-sm italic opacity-70 py-1">
                      <Ban size={14} />
                      {t('message_deleted')}
                    </div>
                  ) : (
                    <>
                      {isScheduled && (
                        <div className="flex items-center gap-1 text-xs text-indigo-100 mb-1 font-medium">
                          <Clock size={12} />
                          {t('scheduled_for')} {format(msg.scheduledFor.toDate(), "dd/MM 'à' HH:mm")}
                        </div>
                      )}
                      {msg.mediaUrl && (
                        <div className="mb-2 rounded-lg overflow-hidden bg-black/10">
                          {msg.mediaType === 'image' && (
                            <img src={msg.mediaUrl} alt="Message media" className="max-w-full max-h-64 object-contain" />
                          )}
                          {msg.mediaType === 'video' && (
                            <video src={msg.mediaUrl} controls className="max-w-full max-h-64" />
                          )}
                          {msg.mediaType === 'file' && (
                            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-3 ${isMine ? 'text-white hover:bg-white/10' : 'text-indigo-600 hover:bg-gray-100 dark:text-indigo-400 dark:hover:bg-gray-800'} transition-colors`}>
                              <Paperclip size={20} />
                              <span className="font-medium underline text-sm">{t('attached_file')}</span>
                            </a>
                          )}
                        </div>
                      )}
                      {msg.text && <p className="whitespace-pre-wrap break-words pr-4">{msg.text}</p>}
                    </>
                  )}
                  <div className={`text-[10px] mt-1 text-right ${isMine ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm', { locale: fr }) : ''}
                  </div>
                </div>
            </div>
          </div>
        );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shrink-0">
        {filePreview && (
          <div className="mb-3 relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 inline-block">
            {fileType === 'image' && (
              <img src={filePreview} alt="Preview" className="max-h-32 object-contain" />
            )}
            {fileType === 'video' && (
              <video src={filePreview} className="max-h-32" controls />
            )}
            {fileType === 'file' && (
              <div className="flex items-center gap-2 p-3 text-gray-700 dark:text-gray-300">
                <Paperclip size={20} />
                <span className="font-medium text-sm">{filePreview}</span>
              </div>
            )}
            <button
              type="button"
              onClick={clearFile}
              className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}
        
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mb-3 w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
            <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <div className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-2xl border border-transparent focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 overflow-hidden flex flex-col transition-all">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleTextareaChange}
              disabled={currentUser?.chatBlocked}
              placeholder={currentUser?.chatBlocked ? t('messaging_blocked_notice') : t('chat_placeholder')}
              className="w-full bg-transparent border-none focus:ring-0 p-3 text-gray-900 dark:text-white resize-none custom-scrollbar disabled:opacity-50"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <div className="flex flex-wrap items-center justify-between px-2 pb-2 gap-2">
              <div className="flex items-center gap-1 shrink-0">
                <label className="p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer" title={t('image')}>
                  <Image size={18} />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'image')} />
                </label>
                <label className="p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer" title={t('video')}>
                  <Video size={18} />
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileSelect(e, 'video')} />
                </label>
                <label className="p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer" title={t('file')}>
                  <Paperclip size={18} />
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={(e) => handleFileSelect(e, 'file')} />
                </label>
                <div className="relative" ref={emojiPickerRef}>
                  <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors" title="Emojis">
                    <Smile size={18} />
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 sm:left-0 -left-16 mb-2 z-50 shadow-xl rounded-lg">
                      <EmojiPicker 
                        onEmojiClick={onEmojiClick}
                        theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT}
                        searchPlaceHolder={t('search_emoji')}
                        width={window.innerWidth < 640 ? 280 : 320}
                        height={400}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {scheduledDate && scheduledTime && (
                  <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg whitespace-nowrap">
                    <Clock size={12} />
                    {format(new Date(`${scheduledDate}T${scheduledTime}`), "dd/MM HH:mm")}
                    <button type="button" onClick={() => { setScheduledDate(''); setScheduledTime(''); }} className="ml-1 hover:text-indigo-800 dark:hover:text-indigo-200">
                      <X size={12} />
                    </button>
                  </div>
                )}
                <button type="button" onClick={() => setShowScheduleModal(true)} className={`p-1.5 rounded-full transition-colors shrink-0 ${scheduledDate ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`} title={t('schedule')}>
                  <Clock size={18} />
                </button>
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={(!newMessage.trim() && !selectedFile) || isSubmitting}
            className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 mb-1"
          >
            <Send size={20} className="ml-0.5" />
          </button>
        </form>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock size={18} className="text-indigo-600" />
                {t('schedule_message')}
              </h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('send_date')}</label>
                <input 
                  type="date" 
                  min={new Date().toISOString().split('T')[0]}
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('send_time')}</label>
                <input 
                  type="time" 
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2 bg-gray-50 dark:bg-gray-800/50">
              <button 
                onClick={() => { setScheduledDate(''); setScheduledTime(''); setShowScheduleModal(false); }}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={() => setShowScheduleModal(false)}
                disabled={!scheduledDate || !scheduledTime}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {t('validate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
