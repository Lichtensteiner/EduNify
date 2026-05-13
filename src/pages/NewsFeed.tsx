import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, arrayRemove, increment, getDocs, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { Image, Camera, Video, Paperclip, Smile, Send, Heart, MessageCircle, MoreVertical, Edit, Trash2, Eye, MessageSquare, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, es } from 'date-fns/locale';
import { notifyAllUsers } from '../services/NotificationService';
import { motion, AnimatePresence } from 'motion/react';

interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  text: string;
  createdAt: any;
}

interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'file';
  createdAt: any;
  likes: string[];
  views: number;
  viewers?: string[];
  commentsCount?: number;
}

interface UserInfo {
  id: string;
  nom: string;
  prenom: string;
  photo?: string;
}

export default function NewsFeed() {
  const { currentUser } = useAuth();
  const { language, t } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | 'file' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Commenting state
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  
  // Modal for likes/views
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalPostId, setModalPostId] = useState<string | null>(null);
  const [modalType, setModalType] = useState<'likes' | 'views' | null>(null);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [modalUsers, setModalUsers] = useState<UserInfo[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Re-fetch users whenever activeIds changes (real-time when modal is open)
  useEffect(() => {
    if (!showUsersModal || activeIds.length === 0) return;

    const fetchUsers = async () => {
      setModalLoading(true);
      try {
        const chunks = [];
        for (let i = 0; i < activeIds.length; i += 30) {
          chunks.push(activeIds.slice(i, i + 30));
        }

        const allUsers: UserInfo[] = [];
        for (const chunk of chunks) {
          const q = query(collection(db, 'users'), where('id', 'in', chunk));
          const snap = await getDocs(q);
          snap.docs.forEach(doc => {
            const data = doc.data();
            allUsers.push({
              id: doc.id,
              nom: data.nom || '',
              prenom: data.prenom || '',
              photo: data.photo
            });
          });
        }
        setModalUsers(allUsers);
      } catch (error) {
        console.error("Error fetching modal users:", error);
      } finally {
        setModalLoading(false);
      }
    };

    fetchUsers();
  }, [showUsersModal, activeIds]);

  const locales = { fr, en: enUS, es };
  const currentLocale = locales[language as keyof typeof locales] || fr;

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
      setPosts(postsData);
    });

    return () => unsubscribe();
  }, []);

  // Listen for comments when a post's comments are shown
  useEffect(() => {
    if (!showCommentsFor) return;

    const q = query(
      collection(db, `posts/${showCommentsFor}/comments`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      
      setComments(prev => ({
        ...prev,
        [showCommentsFor]: commentsData
      }));
    });

    return () => unsubscribe();
  }, [showCommentsFor]);

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

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newPostContent.trim() && !selectedFile) || !currentUser) return;

    setIsSubmitting(true);
    try {
      let mediaUrl = null;
      let finalMediaType = null;

      if (selectedFile) {
        const storageRef = ref(storage, `uploads/posts/${Date.now()}_${selectedFile.name}`);
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

      const authorName = currentUser.prenom || currentUser.nom ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : currentUser.email?.split('@')[0] || 'Utilisateur';

      await addDoc(collection(db, 'posts'), {
        authorId: currentUser.id,
        authorName,
        authorPhotoUrl: currentUser.photo || null,
        content: newPostContent.trim(),
        mediaUrl,
        mediaType: finalMediaType,
        createdAt: serverTimestamp(),
        likes: [],
        views: 0,
        commentsCount: 0
      });
      
      // Notify all users about the new post
      await notifyAllUsers(
        "Nouvelle publication",
        `${authorName} a partagé une nouvelle publication dans le fil d'actualité.`,
        'info',
        'newsfeed'
      );

      setNewPostContent('');
      clearFile();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Erreur lors de la création de la publication');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!newCommentText.trim() || !currentUser) return;

    setIsSubmittingComment(true);
    try {
      const authorName = currentUser.prenom || currentUser.nom ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : currentUser.email?.split('@')[0] || 'Utilisateur';

      await addDoc(collection(db, `posts/${postId}/comments`), {
        authorId: currentUser.id,
        authorName,
        authorPhotoUrl: currentUser.photo || null,
        text: newCommentText.trim(),
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'posts', postId), {
        commentsCount: increment(1)
      });

      setNewCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleLike = async (postId: string, hasLiked: boolean) => {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', postId);
    try {
      if (hasLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(currentUser.id)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(currentUser.id)
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleDelete = async (postId: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer cette publication ?')) {
      try {
        await deleteDoc(doc(db, 'posts', postId));
      } catch (error) {
        console.error('Error deleting post:', error);
      }
    }
  };

  const handleEditSubmit = async (postId: string) => {
    if (!editContent.trim()) return;
    try {
      await updateDoc(doc(db, 'posts', postId), {
        content: editContent.trim()
      });
      setEditingPostId(null);
      setEditContent('');
    } catch (error) {
      console.error('Error updating post:', error);
    }
  };

  const incrementViews = async (postId: string) => {
    if (!currentUser) return;
    try {
       await updateDoc(doc(db, 'posts', postId), {
          views: increment(1),
          viewers: arrayUnion(currentUser.id)
       });
    } catch (error) {
       console.error('Error incrementing views:', error);
    }
  };

  const showInteractionUsers = (title: string, userIds: string[], postId: string, type: 'likes' | 'views') => {
    setModalTitle(title);
    setModalPostId(postId);
    setModalType(type);
    setActiveIds(userIds || []);
    setShowUsersModal(true);
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Create Post Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold shrink-0 uppercase">
            {currentUser?.prenom?.[0] || currentUser?.email?.[0] || 'U'}
          </div>
          <form onSubmit={handleCreatePost} className="flex-1">
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="Partagez quelque chose avec l'établissement..."
              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-lg resize-none focus:ring-0 p-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              rows={3}
            />

            {filePreview && (
              <div className="relative mt-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 inline-block">
                {fileType === 'image' && (
                  <img src={filePreview} alt="Preview" className="max-h-48 object-contain" />
                )}
                {fileType === 'video' && (
                  <video src={filePreview} className="max-h-48" controls />
                )}
                {fileType === 'file' && (
                  <div className="flex items-center gap-2 p-4 text-gray-700 dark:text-gray-300">
                    <Paperclip size={24} />
                    <span className="font-medium">{filePreview}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={clearFile}
                  className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            )}
            
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex gap-2">
                <label className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors cursor-pointer" title="Image">
                  <Image size={20} />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'image')} />
                </label>
                <label className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors cursor-pointer" title="Vidéo">
                  <Video size={20} />
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileSelect(e, 'video')} />
                </label>
                <label className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors cursor-pointer" title="Fichier">
                  <Paperclip size={20} />
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={(e) => handleFileSelect(e, 'file')} />
                </label>
                <button type="button" className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors hidden sm:block" title="Emojis">
                  <Smile size={20} />
                </button>
              </div>
              <button
                type="submit"
                disabled={(!newPostContent.trim() && !selectedFile) || isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={18} />
                <span className="hidden sm:inline">Publier</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="space-y-6">
        {posts.map((post) => {
          const hasLiked = currentUser ? post.likes?.includes(currentUser.id) : false;
          const isAuthor = currentUser?.id === post.authorId;
          const postComments = comments[post.id] || [];
          
          // Update modal IDs in real-time if modal is open for this post
          if (showUsersModal && modalPostId === post.id) {
            const currentIds = modalType === 'likes' ? post.likes : post.viewers;
            if (JSON.stringify(currentIds) !== JSON.stringify(activeIds)) {
               setActiveIds(currentIds || []);
            }
          }

          return (
            <div 
              key={post.id} 
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              onMouseEnter={() => {
                // Increment view if not already viewed by this user
                if (currentUser && !post.viewers?.includes(currentUser.id)) {
                  incrementViews(post.id);
                }
              }}
            >
              {/* Post Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {post.authorPhotoUrl ? (
                    <img src={post.authorPhotoUrl} alt={post.authorName} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold">
                      {post.authorName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{post.authorName}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {post.createdAt ? format(post.createdAt.toDate(), "d MMM yyyy 'à' HH:mm", { locale: currentLocale }) : 'À l\'instant'}
                    </p>
                  </div>
                </div>

                {isAuthor && (
                  <div className="relative group">
                    <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                      <MoreVertical size={20} />
                    </button>
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 hidden group-hover:block z-10">
                      <button
                        onClick={() => {
                          setEditingPostId(post.id);
                          setEditContent(post.content);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <Edit size={16} /> Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                      >
                        <Trash2 size={16} /> Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Post Content */}
              <div className="px-4 pb-3">
                {editingPostId === post.id ? (
                  <div className="mt-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      rows={3}
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => setEditingPostId(null)}
                        className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => handleEditSubmit(post.id)}
                        className="px-3 py-1.5 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-md"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{post.content}</p>
                )}
                
                {post.mediaUrl && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    {post.mediaType === 'image' && (
                      <img src={post.mediaUrl} alt="Post media" className="w-full h-auto max-h-96 object-contain" />
                    )}
                    {post.mediaType === 'video' && (
                      <video src={post.mediaUrl} controls className="w-full h-auto max-h-96" />
                    )}
                    {post.mediaType === 'file' && (
                      <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-4 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <Paperclip size={24} />
                        <span className="font-medium underline">Télécharger le fichier joint</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Post Stats */}
              <div className="px-4 py-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
                <button 
                  onClick={() => showInteractionUsers("Personnes qui ont aimé", post.likes || [], post.id, 'likes')}
                  className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
                >
                  <Heart size={14} className={post.likes?.length > 0 ? "fill-red-500 text-red-500" : ""} />
                  <span>{post.likes?.length || 0}</span>
                </button>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setShowCommentsFor(showCommentsFor === post.id ? null : post.id)}
                    className="hover:underline"
                  >
                    {post.commentsCount || 0} commentaires
                  </button>
                  <button 
                    onClick={() => showInteractionUsers("Personnes qui ont vu", post.viewers || [], post.id, 'views')}
                    className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
                  >
                    <Eye size={14} />
                    <motion.span
                      key={post.viewers?.length || 0}
                      initial={{ scale: 1.2, color: '#4f46e5' }}
                      animate={{ scale: 1, color: 'inherit' }}
                      transition={{ duration: 0.3 }}
                    >
                      {post.viewers?.length || 0} vues
                    </motion.span>
                  </button>
                </div>
              </div>

              {/* Post Actions */}
              <div className="px-2 py-2 flex items-center justify-between border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => handleLike(post.id, hasLiked)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
                    hasLiked 
                      ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Heart size={20} className={hasLiked ? "fill-current" : ""} />
                  <span className="font-medium">J'aime</span>
                </button>
                <button 
                  onClick={() => setShowCommentsFor(showCommentsFor === post.id ? null : post.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
                    showCommentsFor === post.id 
                      ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <MessageCircle size={20} />
                  <span className="font-medium">Commenter</span>
                </button>
              </div>

              {/* Comments Section */}
              {showCommentsFor === post.id && (
                <div className="px-4 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
                  <div className="space-y-4 mb-4">
                    {postComments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        {comment.authorPhotoUrl ? (
                          <img src={comment.authorPhotoUrl} alt={comment.authorName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-xs shrink-0">
                            {comment.authorName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </div>
                        )}
                        <div className="flex-1 bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 dark:border-gray-700">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-sm text-gray-900 dark:text-white">{comment.authorName}</span>
                            <span className="text-[10px] text-gray-400">
                              {comment.createdAt ? format(comment.createdAt.toDate(), "HH:mm", { locale: currentLocale }) : ''}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{comment.text}</p>
                        </div>
                      </div>
                    ))}
                    {postComments.length === 0 && (
                      <p className="text-center text-sm text-gray-500 py-2">Aucun commentaire pour le moment.</p>
                    )}
                  </div>

                  {/* Add Comment Input */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-xs shrink-0 uppercase">
                      {currentUser?.prenom?.[0] || currentUser?.email?.[0] || 'U'}
                    </div>
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment(post.id);
                          }
                        }}
                        placeholder="Écrivez un commentaire..."
                        className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        disabled={!newCommentText.trim() || isSubmittingComment}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full transition-colors disabled:opacity-50"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {posts.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <MessageSquare size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Aucune publication</h3>
            <p className="text-gray-500 dark:text-gray-400">Soyez le premier à partager quelque chose !</p>
          </div>
        )}
      </div>

      {/* Interaction Users Modal */}
      <AnimatePresence>
        {showUsersModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full overflow-hidden"
            >
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-bold text-gray-900 dark:text-white">{modalTitle}</h2>
                <button 
                  onClick={() => setShowUsersModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="max-h-96 overflow-y-auto p-2">
                {modalLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                  </div>
                ) : modalUsers.length === 0 ? (
                  <p className="text-center py-8 text-gray-500 text-sm">Aucun utilisateur trouvé.</p>
                ) : (
                  <div className="space-y-1">
                    {modalUsers.map(user => (
                      <div key={user.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors">
                        {user.photo ? (
                          <img src={user.photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold">
                            {user.prenom?.[0]}{user.nom?.[0]}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{user.prenom} {user.nom}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
