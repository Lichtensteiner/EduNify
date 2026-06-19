import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { recordAuditLog } from '../services/auditService';
import { Search, Filter, Plus, Fingerprint, RefreshCw, Eye, EyeOff, Edit2, Trash2, X, AlertCircle, BellRing, Key, Phone, MapPin, User2, Calendar, GraduationCap, History as HistoryIcon, Mail, Lock, Briefcase, User, Hash, Ban, ShieldOff, Camera } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, addDoc, onSnapshot, query, where } from 'firebase/firestore';
import { initializeApp, getApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, isFirebaseConfigured, firebaseConfig, storage } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { resizeImage } from '../lib/imageUtils';
import SuccessModal from '../components/SuccessModal';
import { useNotification } from '../contexts/NotificationContext';
import { useEstablishment } from '../contexts/EstablishmentContext';
import { motion, AnimatePresence } from 'motion/react';

export default function Users() {
  const { currentUser } = useAuth();
  const { currentEstablishment, isSuperAdmin, establishments } = useEstablishment();
  const { t, tData } = useLanguage();
  const { notifyDelete, notifyUpdate, notifyAdd, notifySuccess, notifyError } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [users, setUsers] = useState<any[]>([]);
  const [houses, setHouses] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [viewUser, setViewUser] = useState<any>(null);
  const [userLogs, setUserLogs] = useState<any[]>([]);
  const [viewTab, setViewTab] = useState<'profile' | 'attendance'>('profile');
  const [editUser, setEditUser] = useState<any>(null);
  const [deleteUser, setDeleteUser] = useState<any>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState({ title: '', message: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationData, setNotificationData] = useState({ title: '', message: '', type: 'info' });
  const [newUser, setNewUser] = useState({
    nom: '',
    prenom: '',
    email: '',
    password: '',
    role: 'élève',
    classe: '',
    classes: [] as string[],
    matiere: '',
    matieres: [] as string[],
    matricule: '',
    contact: '',
    address: '',
    gender: 'not_specified' as 'male' | 'female' | 'other' | 'not_specified',
    dateNaissance: '',
    lieuNaissance: '',
    diploma: '',
    experience_years: '',
    age: '',
    house_id: '',
    position: '',
    photo: '',
    cover: '',
    etablissement: ''
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<{type: 'photo' | 'cover', id: string | 'new'} | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
      setLoading(false);
    }, (err) => {
      console.error(t('error_fetching_users'), err);
      setLoading(false);
    });

    const unsubscribeHouses = onSnapshot(collection(db, 'houses'), (snapshot) => {
      const housesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHouses(housesData);
    });

    const unsubscribeClasses = onSnapshot(collection(db, 'classes'), (snapshot) => {
      const classesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClasses(classesData);
    });

    const unsubscribeSubjects = onSnapshot(collection(db, 'subjects'), (snapshot) => {
      const subjectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSubjects(subjectsData.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')));
    });

    return () => {
      unsubscribe();
      unsubscribeHouses();
      unsubscribeClasses();
      unsubscribeSubjects();
    };
  }, []);

  useEffect(() => {
    if (!viewUser || !isFirebaseConfigured) {
      setUserLogs([]);
      setViewTab('profile');
      return;
    }

    const q = query(
      collection(db, 'attendance_logs'),
      where('user_id', '==', viewUser.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as any).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setUserLogs(logs);
    });

    return () => unsubscribe();
  }, [viewUser]);

  const handleDeleteLog = async (logId: string) => {
    if (!window.confirm(t('confirm_delete_log'))) return;
    try {
      await deleteDoc(doc(db, 'attendance_logs', logId));
      notifyDelete("Le log de pointage");
    } catch (err) {
      console.error("Error deleting log:", err);
      notifyError(t('delete_error'));
    }
  };

  const handleUpdateLogType = async (logId: string, currentType: string) => {
    const newType = currentType === 'entry' ? 'exit' : 'entry';
    try {
      await updateDoc(doc(db, 'attendance_logs', logId), { type: newType });
    } catch (err) {
      console.error("Error updating log:", err);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUser({ ...newUser, password: pass });
    setShowPassword(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'cover', target: 'new' | 'edit') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage({ type, id: target === 'new' ? 'new' : editUser.id });
    setError('');

    try {
      const maxWidth = type === 'photo' ? 400 : 1200;
      const maxHeight = type === 'photo' ? 400 : 600;
      const resizedBlob = await resizeImage(file, maxWidth, maxHeight);

      const path = target === 'new' 
        ? `temp_uploads/${Date.now()}_${type}` 
        : `users/${editUser.id}/${type}_${Date.now()}`;
      
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, resizedBlob);
      const downloadURL = await getDownloadURL(storageRef);

      if (target === 'new') {
        setNewUser({ ...newUser, [type]: downloadURL });
      } else {
        setEditUser({ ...editUser, [type]: downloadURL });
      }
    } catch (err) {
      console.error("Error uploading image:", err);
      setError(t('upload_error'));
    } finally {
      setUploadingImage(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.password || newUser.password.length < 6) {
      setError(t('password_min_length'));
      return;
    }
    
    setActionLoading(true);
    setError('');

    // Force role to non-admin if not super-admin
    let finalRole = newUser.role;
    if (finalRole === 'admin' && currentUser?.email !== 'martinienmvezogo@gmail.com') {
      finalRole = 'personnel administratif';
    }

    try {
      // Initialize a secondary Firebase app to create the user without signing out the current admin
      const secondaryApp = getApps().find(app => app.name === 'SecondaryApp') || initializeApp(firebaseConfig, 'SecondaryApp');
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
      
      // Save user data to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        nom: newUser.nom,
        prenom: newUser.prenom,
        email: newUser.email,
        role: finalRole,
        etablissement: isSuperAdmin ? (newUser.etablissement || currentEstablishment?.id || 'EDU-001') : (currentEstablishment?.id || 'EDU-001'),
        classe: newUser.role === 'élève' ? newUser.classe : null,
        classes: newUser.role === 'enseignant' ? newUser.classes : null,
        matiere: newUser.role === 'enseignant' ? (newUser.matieres[0] || null) : null,
        matieres: newUser.role === 'enseignant' ? newUser.matieres : null,
        matricule: newUser.matricule || null,
        contact: newUser.contact || null,
        address: newUser.address || null,
        gender: newUser.gender || 'not_specified',
        dateNaissance: newUser.dateNaissance || null,
        lieuNaissance: newUser.lieuNaissance || null,
        diploma: newUser.diploma || null,
        experience_years: newUser.experience_years ? parseInt(newUser.experience_years as string) : null,
        age: newUser.age ? parseInt(newUser.age as string) : null,
        house_id: newUser.role === 'élève' && newUser.house_id ? newUser.house_id : null,
        position: finalRole === 'personnel administratif' ? (newUser.position || null) : null,
        department: finalRole === 'personnel administratif' ? 'Administration' : null,
        photo: newUser.photo || null,
        cover: newUser.cover || null,
        date_creation: new Date().toISOString()
      }, { merge: true });
      
      // Sign out and clean up the secondary app
      await signOut(secondaryAuth);
      await recordAuditLog({
        userId: currentUser?.id || 'admin',
        userName: currentUser ? `${currentUser.prenom} ${currentUser.nom}` : 'Administrateur',
        userRole: currentUser?.role || 'admin',
        action: "Création d'utilisateur",
        details: `Nom: ${newUser.prenom} ${newUser.nom}, Email: ${newUser.email}, Rôle: ${newUser.role}`,
        category: 'security'
      });

      setShowAddUserModal(false);
      setNewUser({ 
        nom: '', 
        prenom: '', 
        email: '', 
        password: '', 
        role: 'élève', 
        classe: '', 
        classes: [], 
        matiere: '', 
        matieres: [], 
        matricule: '', 
        contact: '', 
        address: '', 
        gender: 'not_specified', 
        dateNaissance: '', 
        lieuNaissance: '', 
        diploma: '', 
        experience_years: '', 
        age: '', 
        house_id: '',
        position: '',
        photo: '',
        cover: '',
        etablissement: ''
      });
      setSuccessInfo({
        title: t('account_created'),
        message: t('user_profile_generated_success').replace('{{name}}', `${newUser.prenom} ${newUser.nom}`)
      });
      notifyAdd(`${newUser.prenom} ${newUser.nom}`);
      setShowSuccess(true);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError(t('email_already_in_use'));
      } else {
        setError(t('error_adding_user'));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    
    setActionLoading(true);
    setError('');

    // Force role to non-admin if not super-admin
    let finalRole = editUser.role;
    if (finalRole === 'admin' && currentUser?.email !== 'martinienmvezogo@gmail.com') {
        const originalUser = users.find(u => u.id === editUser.id);
        finalRole = originalUser?.role || 'élève';
    }

    try {
      const userRef = doc(db, 'users', editUser.id);
      await updateDoc(userRef, {
        nom: editUser.nom,
        prenom: editUser.prenom,
        role: finalRole,
        etablissement: isSuperAdmin ? (editUser.etablissement || null) : (editUser.etablissement || currentEstablishment?.id || null),
        classe: editUser.role === 'élève' ? editUser.classe : null,
        classes: editUser.role === 'enseignant' ? (editUser.classes || []) : null,
        matiere: editUser.role === 'enseignant' ? (editUser.matieres?.[0] || null) : null,
        matieres: editUser.role === 'enseignant' ? (editUser.matieres || []) : null,
        matricule: editUser.matricule || null,
        contact: editUser.contact || null,
        address: editUser.address || null,
        gender: editUser.gender || 'not_specified',
        dateNaissance: editUser.dateNaissance || null,
        lieuNaissance: editUser.lieuNaissance || null,
        diploma: editUser.diploma || null,
        experience_years: editUser.experience_years ? parseInt(editUser.experience_years.toString()) : null,
        age: editUser.age ? parseInt(editUser.age.toString()) : null,
        photo: editUser.photo || null,
        cover: editUser.cover || null,
        house_id: editUser.role === 'élève' && editUser.house_id ? editUser.house_id : null,
        position: finalRole === 'personnel administratif' ? (editUser.position || null) : null,
        department: finalRole === 'personnel administratif' ? 'Administration' : null
      });

      await recordAuditLog({
        userId: currentUser?.id || 'admin',
        userName: currentUser ? `${currentUser.prenom} ${currentUser.nom}` : 'Administrateur',
        userRole: currentUser?.role || 'admin',
        action: "Mise à jour d'utilisateur",
        details: `Utilisateur: ${editUser.prenom} ${editUser.nom}, ID: ${editUser.id}`,
        category: 'security'
      });

      notifyUpdate(`${editUser.prenom} ${editUser.nom}`);
      setEditUser(null);
    } catch (err: any) {
      console.error(err);
      notifyError(t('error_updating_user'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    
    setActionLoading(true);
    setError('');
    try {
      await deleteDoc(doc(db, 'users', deleteUser.id));

      await recordAuditLog({
        userId: currentUser?.id || 'admin',
        userName: currentUser ? `${currentUser.prenom} ${currentUser.nom}` : 'Administrateur',
        userRole: currentUser?.role || 'admin',
        action: "Suppression d'utilisateur",
        details: `Utilisateur supprimé: ${deleteUser.prenom} ${deleteUser.nom}, ID: ${deleteUser.id}`,
        category: 'security'
      });

      notifyDelete(`${deleteUser.prenom} ${deleteUser.nom}`);
      setDeleteUser(null);
    } catch (err: any) {
      console.error(err);
      notifyError(t('error_deleting_user'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleChatBlock = async (user: any) => {
    try {
      await updateDoc(doc(db, 'users', user.id), {
        chatBlocked: !user.chatBlocked
      });

      await recordAuditLog({
        userId: currentUser?.id || 'admin',
        userName: currentUser ? `${currentUser.prenom} ${currentUser.nom}` : 'Administrateur',
        userRole: currentUser?.role || 'admin',
        action: user.chatBlocked ? "Déblocage messagerie" : "Blocage messagerie",
        details: `Utilisateur: ${user.prenom} ${user.nom}`,
        category: 'security'
      });

      const toastMsg = !user.chatBlocked ? t('messaging_blocked') : t('messaging_unblocked');
      notifySuccess(toastMsg.replace('{{name}}', `${user.prenom} ${user.nom}`));
    } catch (err) {
      console.error("Error toggling chat block:", err);
      notifyError(t('error_updating_user'));
    }
  };

  const handleToggleAccessBlock = async (user: any) => {
    try {
      await updateDoc(doc(db, 'users', user.id), {
        accessBlocked: !user.accessBlocked
      });

      await recordAuditLog({
        userId: currentUser?.id || 'admin',
        userName: currentUser ? `${currentUser.prenom} ${currentUser.nom}` : 'Administrateur',
        userRole: currentUser?.role || 'admin',
        action: user.accessBlocked ? "Déblocage accès" : "Blocage accès",
        details: `Utilisateur: ${user.prenom} ${user.nom}`,
        category: 'security'
      });

      const toastMsg = !user.accessBlocked ? t('access_blocked') : t('access_unblocked');
      notifySuccess(toastMsg.replace('{{name}}', `${user.prenom} ${user.nom}`));
    } catch (err) {
      console.error("Error toggling access block:", err);
      notifyError(t('error_updating_user'));
    }
  };

  const handleQuickAssignClass = async (userId: string, className: string) => {
    if (!className) return;
    try {
      await updateDoc(doc(db, 'users', userId), { 
        classe: className,
        role: 'élève' // Ensure it stays élève if it was already
      });
    } catch (err) {
      console.error("Error assigning class:", err);
    }
  };

  const filteredUsers = users.filter(user => {
    // Multi-tenant isolated workspace
    if (!isSuperAdmin) {
      const activeEstId = currentEstablishment?.id || currentUser?.etablissement || 'EDU-001';
      if (user.etablissement !== activeEstId) return false;
    }
    const matchesSearch = user.nom?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          user.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.matricule?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  }).sort((a, b) => {
    const nameA = `${a.nom || ''} ${a.prenom || ''}`.trim().toLowerCase();
    const nameB = `${b.nom || ''} ${b.prenom || ''}`.trim().toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationData.title || !notificationData.message) return;
    
    setActionLoading(true);
    setError('');
    try {
      // Send to all filtered users
      const usersToNotify = filteredUsers;
      
      const promises = usersToNotify.map(user => 
        addDoc(collection(db, 'notifications'), {
          user_id: user.id,
          title: notificationData.title,
          message: notificationData.message,
          type: notificationData.type,
          read: false,
          timestamp: new Date().toISOString()
        })
      );
      
      await Promise.all(promises);
      setShowNotificationModal(false);
      setNotificationData({ title: '', message: '', type: 'info' });
      notifySuccess(t('notification_sent_success_to').replace('{{count}}', usersToNotify.length.toString()));
    } catch (err: any) {
      console.error(err);
      setError(t('error_sending_notification'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('users')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('manage_users')}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setShowNotificationModal(true)}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors shadow-sm flex-1 sm:flex-none"
          >
            <BellRing size={18} />
            <span className="whitespace-nowrap">{t('notify_selection')}</span>
          </button>
          <button 
            onClick={() => setShowAddUserModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors shadow-sm flex-1 sm:flex-none"
          >
            <Plus size={18} />
            <span className="whitespace-nowrap">{t('add_user')}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/50">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder={t('search_placeholder')} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter size={18} className="text-gray-400" />
            <select 
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="bg-white border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2"
            >
              <option value="all">{t('all')}</option>
              <option value="élève">{tData('élève')}</option>
              <option value="enseignant">{tData('enseignant')}</option>
              <option value="personnel administratif">{tData('personnel administratif')}</option>
              <option value="cuisinier">{tData('cuisinier')}</option>
              <option value="admin">{tData('admin')}</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 min-w-[800px]">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold">{t('name')} & {t('firstname')}</th>
                <th scope="col" className="px-6 py-4 font-semibold">{t('class')}</th>
                <th scope="col" className="px-6 py-4 font-semibold">{t('principal_teacher')}</th>
                <th scope="col" className="px-6 py-4 font-semibold">{t('born_on')}</th>
                <th scope="col" className="px-6 py-4 font-semibold">{t('id_number')}</th>
                <th scope="col" className="px-6 py-4 font-semibold">{t('role')}</th>
                <th scope="col" className="px-6 py-4 font-semibold">{t('contact')}</th>
                <th scope="col" className="px-6 py-4 font-semibold font-bold">{t('bio')}</th>
                <th scope="col" className="px-6 py-4 font-semibold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <RefreshCw className="animate-spin mx-auto text-indigo-600 mb-2" size={24} />
                    <p className="text-gray-500">{t('loading_users')}</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    {t('no_users_found')} {!isFirebaseConfigured && t('configure_firebase')}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const userClass = classes.find(c => c.nom === user.classe);
                  const teacher = userClass && userClass.professeur_principal_id ? users.find(u => u.id === userClass.professeur_principal_id) : null;
                  const teacherName = teacher ? `${teacher.prenom || ''} ${teacher.nom || ''}`.trim() : 'N/A';

                  return (
                  <tr key={user.id} className="bg-white border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.photo ? (
                          <img src={user.photo} alt="" className="w-8 h-8 rounded-full object-cover shadow-sm bg-gray-100" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[10px] uppercase">
                            {user.prenom?.[0] || user.email?.[0] || 'U'}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                            {user.nom || user.prenom ? `${user.nom || ''} ${user.prenom || ''}`.trim() : user.email?.split('@')[0] || t('user')}
                          </div>
                          <div className="text-[10px] text-gray-400 font-medium lowercase italic">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'élève' ? (
                        user.classe ? (
                          <div className="text-sm font-bold text-indigo-600">{user.classe}</div>
                        ) : (
                          <select 
                            onChange={(e) => handleQuickAssignClass(user.id, e.target.value)}
                            className="text-[10px] p-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 transition-all font-bold"
                          >
                            <option value="">{t('assign_class')}</option>
                            {classes.map(cls => (
                              <option key={cls.id} value={cls.nom}>{cls.nom}</option>
                            ))}
                          </select>
                        )
                      ) : (
                        <span className="text-gray-400 italic text-xs">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'élève' ? (
                        <div className="text-xs text-gray-600 font-medium whitespace-nowrap">
                          {teacherName}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-xs">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 font-medium whitespace-nowrap">
                      {user.dateNaissance || '-'}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-600">
                      {user.matricule || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        user.role === 'élève' ? 'bg-blue-100 text-blue-700' :
                        user.role === 'enseignant' ? 'bg-purple-100 text-purple-700' :
                        user.role === 'admin' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {tData(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
                          <Phone size={10} className="text-gray-400" />
                          {user.contact || '-'}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[120px]" title={user.address}>
                          {user.address || '-'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.face_id || user.fingerprint_id ? (
                        <div className="flex -space-x-1">
                          {user.face_id && (
                            <div className="p-1 bg-emerald-100 text-emerald-600 rounded-full border-2 border-white" title={t('face_registered')}>
                              <User2 size={10} />
                            </div>
                          )}
                          {user.fingerprint_id && (
                            <div className="p-1 bg-blue-100 text-blue-600 rounded-full border-2 border-white" title={t('fingerprint_registered')}>
                              <Fingerprint size={10} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-amber-500 font-bold uppercase">{t('not_configured')}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleToggleChatBlock(user)}
                          className={`p-2 rounded-lg transition-colors ${user.chatBlocked ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'}`}
                          title={user.chatBlocked ? t('unblock_messaging') : t('block_messaging')}
                        >
                          <Ban size={18} />
                        </button>
                        <button 
                          onClick={() => handleToggleAccessBlock(user)}
                          className={`p-2 rounded-lg transition-colors ${user.accessBlocked ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                          title={user.accessBlocked ? t('unblock_access') : t('block_access')}
                        >
                          <ShieldOff size={18} />
                        </button>
                        <button 
                          onClick={() => setViewUser(user)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title={t('view_details')}
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => setEditUser({...user})}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={t('edit')}
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => setDeleteUser(user)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={t('delete')}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {viewUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <User size={20} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('user_details')}</h3>
              </div>
              <button onClick={() => setViewUser(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 dark:border-gray-700">
              <button 
                onClick={() => setViewTab('profile')}
                className={`flex-1 py-3 text-sm font-bold transition-all ${viewTab === 'profile' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                {t('profile')}
              </button>
              <button 
                onClick={() => setViewTab('attendance')}
                className={`flex-1 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${viewTab === 'attendance' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                <HistoryIcon size={16} />
                Historique des Pointages
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {viewTab === 'profile' ? (
                <>
                  <div className="relative group overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm mb-6">
                    {/* Cover Image in View */}
                    <div className="h-24 bg-indigo-600 relative">
                      {viewUser.cover ? (
                        <img src={viewUser.cover} alt="Cover" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                      )}
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-white dark:bg-gray-800 pt-10 relative">
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 md:left-6 md:translate-x-0">
                        {viewUser.photo ? (
                          <img src={viewUser.photo} alt="" className="w-24 h-24 rounded-2xl object-cover shadow-lg border-4 border-white dark:border-gray-800 bg-white" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-24 h-24 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-3xl uppercase shadow-lg border-4 border-white dark:border-gray-800">
                            {viewUser.prenom?.[0]}{viewUser.nom?.[0]}
                          </div>
                        )}
                      </div>
                      <div className="text-center md:text-left mt-8 md:mt-0 md:pl-28">
                        <h4 className="text-2xl font-bold text-gray-900 dark:text-white">{viewUser.prenom} {viewUser.nom}</h4>
                        <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                          <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-bold uppercase tracking-wider">
                            {tData(viewUser.role)}
                          </span>
                          {viewUser.matricule && (
                            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs font-mono">
                              #{viewUser.matricule}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 mt-3 flex items-center justify-center md:justify-start gap-2 text-sm">
                          <Mail size={14} />
                          {viewUser.email}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Personal Information */}
                    <div className="space-y-4">
                      <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <User size={14} />
                        Informations Personnelles
                      </h5>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50">
                          <span className="text-sm text-gray-500">Date de Naissance</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{viewUser.dateNaissance || '-'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50">
                          <span className="text-sm text-gray-500">Lieu de Naissance</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{viewUser.lieuNaissance || '-'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50">
                          <span className="text-sm text-gray-500">{t('gender')}</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{viewUser.gender ? t(viewUser.gender) : '-'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50">
                          <span className="text-sm text-gray-500">{t('age')}</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{viewUser.age || '-'} ans</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50">
                          <span className="text-sm text-gray-500">{t('address')}</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-200 flex items-center gap-1">
                            <MapPin size={14} className="text-gray-400" />
                            {viewUser.address || '-'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50">
                          <span className="text-sm text-gray-500">{t('contact')}</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-200 flex items-center gap-1">
                            <Phone size={14} className="text-gray-400" />
                            {viewUser.contact || '-'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Professional/Academic Information */}
                    <div className="space-y-4">
                      <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Briefcase size={14} />
                        Profil {viewUser.role === 'élève' ? 'Académique' : 'Professionnel'}
                      </h5>
                      <div className="space-y-3">
                        {viewUser.role === 'élève' ? (
                          <>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50">
                              <span className="text-sm text-gray-500">{t('class')}</span>
                              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{viewUser.classe || t('not_defined')}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50">
                              <span className="text-sm text-gray-500">{t('house')}</span>
                              <span className="text-sm font-medium">
                                {viewUser.house_id && houses.find(h => h.id === viewUser.house_id) ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${houses.find(h => h.id === viewUser.house_id)?.color}20`, color: houses.find(h => h.id === viewUser.house_id)?.color }}>
                                    {houses.find(h => h.id === viewUser.house_id)?.logo?.startsWith('http') ? (
                                      <img src={houses.find(h => h.id === viewUser.house_id)?.logo} alt="" className="w-4 h-4 object-cover rounded-full" referrerPolicy="no-referrer" />
                                    ) : (
                                      <span>{houses.find(h => h.id === viewUser.house_id)?.logo}</span>
                                    )}
                                    {houses.find(h => h.id === viewUser.house_id)?.nom_maison}
                                  </span>
                                ) : t('not_defined')}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50">
                              <span className="text-sm text-gray-500">{t('diploma')}</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{viewUser.diploma || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50">
                              <span className="text-sm text-gray-500">{t('experience_years')}</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{viewUser.experience_years || '-'} ans</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50">
                          <span className="text-sm text-gray-500">{t('registration_date')}</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                            {viewUser.date_creation ? new Date(viewUser.date_creation).toLocaleDateString() : t('unknown')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Specific sections for teachers */}
                  {viewUser.role === 'enseignant' && (
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Briefcase size={14} />
                            Matières Enseignées
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {viewUser.matieres && viewUser.matieres.length > 0 ? (
                              viewUser.matieres.map((m: string) => (
                                <span key={m} className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-bold border border-blue-100 dark:border-blue-800">
                                  {m}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400 italic text-xs">Aucune matière définie</span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <GraduationCap size={14} />
                            Classes Assignées
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {viewUser.classes && viewUser.classes.length > 0 ? (
                              viewUser.classes.map((c: string) => (
                                <span key={c} className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold border border-emerald-100 dark:border-emerald-800">
                                  {c}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400 italic text-xs">Aucune classe assignée</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Biometric Status */}
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                    <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Fingerprint size={14} />
                      Statut Biométrique
                    </h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div className={`p-4 rounded-xl border flex items-center gap-3 ${viewUser.face_id ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-400'}`}>
                        <User size={20} className={viewUser.face_id ? 'text-emerald-600' : 'text-gray-300'} />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-tight">Reconnaissance Faciale</p>
                          <p className="text-[10px]">{viewUser.face_id ? 'Enregistré' : 'Non configuré'}</p>
                        </div>
                      </div>
                      <div className={`p-4 rounded-xl border flex items-center gap-3 ${viewUser.fingerprint_id ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-400'}`}>
                        <Fingerprint size={20} className={viewUser.fingerprint_id ? 'text-emerald-600' : 'text-gray-300'} />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-tight">Empreinte Digitale</p>
                          <p className="text-[10px]">{viewUser.fingerprint_id ? 'Enregistré' : 'Non configuré'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h5 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <HistoryIcon size={16} className="text-indigo-600" />
                      Tous les mouvements enregistrés
                    </h5>
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{userLogs.length} scans au total</span>
                  </div>

                  <div className="overflow-hidden border border-gray-100 dark:border-gray-700 rounded-2xl">
                    <table className="w-full text-sm text-left text-gray-500">
                      <thead className="text-[10px] text-gray-400 uppercase bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th className="px-4 py-3 font-black">{t('date')}</th>
                          <th className="px-4 py-3 font-black">{t('hour')}</th>
                          <th className="px-4 py-3 font-black">{t('action')}</th>
                          <th className="px-4 py-3 font-black text-right">{t('admin_actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50 font-medium">
                        {userLogs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-12 text-center text-gray-400 italic">
                              {t('no_logs_found')}
                            </td>
                          </tr>
                        ) : (
                          userLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                {new Date(log.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">
                                {log.time}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                                  log.type === 'entry' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {t(log.type)} {log.isLate && <span className="ml-1 text-red-600">{t('late_caps')}</span>}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-1">
                                  <button 
                                    onClick={() => handleUpdateLogType(log.id, log.type)}
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"
                                    title={t('change_type')}
                                  >
                                    <RefreshCw size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteLog(log.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                    title={t('delete')}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button 
                onClick={() => setViewUser(null)}
                className="px-8 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-sm transition-all shadow-sm"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Edit2 size={20} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('edit_user')}</h3>
              </div>
              <button onClick={() => setEditUser(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-100 dark:border-red-800 flex items-center gap-2">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}

                {/* Profile & Cover Selection */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Camera size={14} />
                    {t('profile_cover_photos')}
                  </h4>
                  <div className="flex flex-col gap-4">
                    {/* Cover Preview & Upload */}
                    <div className="relative h-32 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                      {editUser.cover ? (
                        <img src={editUser.cover} alt="Cover" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs italic">
                          {t('no_cover_image')}
                        </div>
                      )}
                      <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleImageUpload(e, 'cover', 'edit')}
                          disabled={uploadingImage !== null}
                        />
                        {uploadingImage?.type === 'cover' && uploadingImage.id === editUser.id ? <RefreshCw className="text-white animate-spin" /> : <div className="flex items-center gap-2 text-white font-bold text-xs"><Camera size={16} /> {t('change_cover')}</div>}
                      </label>
                    </div>

                    {/* Profile Photo Preview & Upload */}
                    <div className="flex items-center gap-6">
                      <div className="relative group">
                        {editUser.photo ? (
                          <img src={editUser.photo} alt="Profile" className="w-20 h-20 rounded-2xl object-cover border-4 border-white dark:border-gray-800 shadow-sm" />
                        ) : (
                          <div className="w-20 h-20 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-2xl uppercase border-4 border-white dark:border-gray-800 shadow-sm">
                            {editUser.prenom?.[0] || editUser.email?.[0] || 'U'}
                          </div>
                        )}
                        <label className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleImageUpload(e, 'photo', 'edit')}
                            disabled={uploadingImage !== null}
                          />
                          {uploadingImage?.type === 'photo' && uploadingImage.id === editUser.id ? <RefreshCw className="text-white animate-spin" /> : <Camera className="text-white" size={20} />}
                        </label>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{t('profile_photo_label')}</p>
                        <p className="text-xs text-gray-500">{t('click_to_edit_img')}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Personal Info */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <User size={14} />
                      {t('personal_info')}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('name')}</label>
                        <input
                          type="text"
                          required
                          value={editUser.nom}
                          onChange={(e) => setEditUser({...editUser, nom: e.target.value})}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('firstname')}</label>
                        <input
                          type="text"
                          required
                          value={editUser.prenom}
                          onChange={(e) => setEditUser({...editUser, prenom: e.target.value})}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('id_number')}</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          value={editUser.matricule || ''}
                          onChange={(e) => setEditUser({...editUser, matricule: e.target.value})}
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('birth_date')}</label>
                        <input
                          type="date"
                          value={editUser.dateNaissance || ''}
                          onChange={(e) => setEditUser({...editUser, dateNaissance: e.target.value})}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('birth_place')}</label>
                        <input
                          type="text"
                          value={editUser.lieuNaissance || ''}
                          onChange={(e) => setEditUser({...editUser, lieuNaissance: e.target.value})}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('gender')}</label>
                        <select
                          value={editUser.gender || 'not_specified'}
                          onChange={(e) => setEditUser({...editUser, gender: e.target.value as any})}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        >
                          <option value="not_specified">{t('not_specified')}</option>
                          <option value="male">{t('male')}</option>
                          <option value="female">{t('female')}</option>
                          <option value="other">{t('other')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('age')}</label>
                        <input
                          type="number"
                          value={editUser.age || ''}
                          onChange={(e) => setEditUser({...editUser, age: e.target.value})}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact & Professional */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <Phone size={14} />
                      {t('contact_prof')}
                    </h4>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('contact')}</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          value={editUser.contact || ''}
                          onChange={(e) => setEditUser({...editUser, contact: e.target.value})}
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('address')}</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          value={editUser.address || ''}
                          onChange={(e) => setEditUser({...editUser, address: e.target.value})}
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('diploma')}</label>
                        <div className="relative">
                          <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="text"
                            value={editUser.diploma || ''}
                            onChange={(e) => setEditUser({...editUser, diploma: e.target.value})}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('experience_years')}</label>
                        <div className="relative">
                          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="number"
                            value={editUser.experience_years || ''}
                            onChange={(e) => setEditUser({...editUser, experience_years: e.target.value})}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Key size={14} />
                    {t('role_assignment')}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('role')}</label>
                      <select
                        value={editUser.role}
                        onChange={(e) => setEditUser({...editUser, role: e.target.value})}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                      >
                        <option value="élève">{tData('élève')}</option>
                        <option value="enseignant">{tData('enseignant')}</option>
                        <option value="personnel administratif">{tData('personnel administratif')}</option>
                        <option value="cuisinier">{tData('cuisinier')}</option>
                        {isSuperAdmin && (
                          <option value="admin">Administrateur d'Établissement ({tData('admin')})</option>
                        )}
                      </select>
                    </div>

                    {isSuperAdmin && (
                      <div>
                        <label className="block text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1.5 ml-1 uppercase font-bold text-[11px] tracking-wide">🏫 Établissement de rattachement</label>
                        <select
                          required
                          value={editUser.etablissement || ''}
                          onChange={(e) => setEditUser({...editUser, etablissement: e.target.value})}
                          className="w-full px-4 py-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold text-indigo-900 dark:text-indigo-300"
                        >
                          <option value="">Sélectionner un établissement</option>
                          {establishments.map(est => (
                            <option key={est.id} value={est.id}>{est.id} - {est.nom}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {editUser.role === 'élève' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('class')}</label>
                          <select
                            required
                            value={editUser.classe || ''}
                            onChange={(e) => setEditUser({...editUser, classe: e.target.value})}
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                          >
                            <option value="">{t('select_class')}</option>
                            {classes.map(cls => (
                              <option key={cls.id} value={cls.nom}>{cls.nom}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('house_optional')}</label>
                          <select
                            value={editUser.house_id || ''}
                            onChange={(e) => setEditUser({...editUser, house_id: e.target.value})}
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                          >
                            <option value="">{t('no_house')}</option>
                            {houses.map(house => (
                              <option key={house.id} value={house.id}>{house.nom_maison}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {editUser.role === 'personnel administratif' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">Responsabilité / Poste</label>
                        <select
                          required
                          value={editUser.position || ''}
                          onChange={(e) => setEditUser({...editUser, position: e.target.value})}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        >
                          <option value="">Sélectionner une responsabilité</option>
                          <option value="responsable collège">Responsable collège</option>
                          <option value="responsable primaire">Responsable primaire</option>
                          <option value="responsable maternelle">Responsable maternelle</option>
                          <option value="secrétaire générale">Secrétaire générale</option>
                          <option value="secrétaire adjoint">Secrétaire adjoint</option>
                          <option value="surveillant">Surveillant</option>
                          <option value="comptable">Comptable</option>
                          <option value="chargé pédagogique">Chargé pédagogique</option>
                        </select>
                      </div>
                    )}

                    {editUser.role === 'enseignant' && (
                      <div className="col-span-1 md:col-span-2 space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-2 ml-1 uppercase">{t('subjects')}</label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50">
                            {subjects.length > 0 ? (
                              subjects.map(subj => (
                                <label key={subj.id} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={(editUser.matieres || []).includes(subj.name)}
                                    onChange={(e) => {
                                      const currentSubjects = editUser.matieres || [];
                                      if (e.target.checked) {
                                        setEditUser({...editUser, matieres: [...currentSubjects, subj.name]});
                                      } else {
                                        setEditUser({...editUser, matieres: currentSubjects.filter((s: string) => s !== subj.name)});
                                      }
                                    }}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="text-xs text-gray-700 dark:text-gray-300">{subj.name}</span>
                                </label>
                              ))
                            ) : (
                                <p className="text-xs text-gray-500 col-span-full p-2 italic">Aucune matière trouvée dans le répertoire.</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-2 ml-1 uppercase">{t('assigned_classes')}</label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50">
                            {classes.map(cls => (
                              <label key={cls.id} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                                <input
                                  type="checkbox"
                                  checked={(editUser.classes || []).includes(cls.nom)}
                                  onChange={(e) => {
                                    const currentClasses = editUser.classes || [];
                                    if (e.target.checked) {
                                      setEditUser({...editUser, classes: [...currentClasses, cls.nom]});
                                    } else {
                                      setEditUser({...editUser, classes: currentClasses.filter((c: string) => c !== cls.nom)});
                                    }
                                  }}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs text-gray-700 dark:text-gray-300">{cls.nom}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-sm transition-all shadow-sm"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="animate-spin" size={18} /> : null}
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                <AlertCircle size={40} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{t('delete_user_confirm')}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                {t('delete_user_warning')} <br />
                <span className="font-bold text-gray-900 dark:text-white text-lg block mt-2">
                  {deleteUser.prenom} {deleteUser.nom}
                </span>
              </p>
              {error && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-100 dark:border-red-800">
                  {error}
                </div>
              )}
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-center gap-3">
              <button 
                onClick={() => setDeleteUser(null)}
                className="order-2 sm:order-1 px-8 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-sm transition-all shadow-sm"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleDelete}
                disabled={actionLoading}
                className="order-1 sm:order-2 px-8 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-sm transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? <RefreshCw className="animate-spin" size={18} /> : null}
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Notification Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{t('send_notification')}</h2>
              <button 
                onClick={() => setShowNotificationModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSendNotification} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              
              <div className="bg-indigo-50 text-indigo-700 p-3 rounded-xl text-sm mb-4">
                {t('notification_target_info').replace('{count}', filteredUsers.length.toString())}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('title')}</label>
                <input 
                  type="text" 
                  required
                  value={notificationData.title}
                  onChange={(e) => setNotificationData({...notificationData, title: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  placeholder={t('notification_title_placeholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('message')}</label>
                <textarea 
                  required
                  rows={4}
                  value={notificationData.message}
                  onChange={(e) => setNotificationData({...notificationData, message: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                  placeholder={t('notification_message_placeholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('type')}</label>
                <select 
                  value={notificationData.type}
                  onChange={(e) => setNotificationData({...notificationData, type: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                >
                  <option value="info">{t('info')}</option>
                  <option value="warning">{t('warning')}</option>
                  <option value="success">{t('success')}</option>
                </select>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowNotificationModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading ? <RefreshCw size={18} className="animate-spin" /> : <BellRing size={18} />}
                  {t('send')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <Plus size={20} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('add_user')}</h3>
              </div>
              <button onClick={() => setShowAddUserModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-100 dark:border-red-800 flex items-center gap-2">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}

                {/* Profile & Cover Selection */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Camera size={14} />
                    {t('profile_cover_photos')} {t('optional')}
                  </h4>
                  <div className="flex flex-col gap-4">
                    <div className="relative h-28 rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700">
                      {newUser.photo || newUser.cover ? (
                         newUser.cover && <img src={newUser.cover} alt="Cover" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs italic">
                          {t('no_cover_selected')}
                        </div>
                      )}
                      <label className="absolute inset-0 bg-black/5 hover:bg-black/20 flex items-center justify-center transition-all cursor-pointer">
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleImageUpload(e, 'cover', 'new')}
                          disabled={uploadingImage !== null}
                        />
                        {uploadingImage?.type === 'cover' && uploadingImage.id === 'new' ? <RefreshCw className="text-gray-600 animate-spin" /> : <div className="flex items-center gap-2 text-gray-600 bg-white/80 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm border border-gray-200"><Camera size={14} /> {t('add_cover')}</div>}
                      </label>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        {newUser.photo ? (
                          <img src={newUser.photo} alt="Profile" className="w-16 h-16 rounded-2xl object-cover border-2 border-white dark:border-gray-800 shadow-sm" />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700">
                            <User size={24} />
                          </div>
                        )}
                        <label className="absolute inset-0 bg-black/0 hover:bg-black/20 rounded-2xl flex items-center justify-center transition-all cursor-pointer">
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleImageUpload(e, 'photo', 'new')}
                            disabled={uploadingImage !== null}
                          />
                          {uploadingImage?.type === 'photo' && uploadingImage.id === 'new' ? <RefreshCw className="text-gray-600 animate-spin" /> : null}
                        </label>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{t('profile_photo_label')}</p>
                        <button 
                          type="button"
                          className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md mt-1 hover:bg-indigo-100 font-bold uppercase transition-colors"
                          onClick={() => document.getElementById('photo-upload-new')?.click()}
                        >
                          {t('choose_photo')}
                        </button>
                        <input 
                          id="photo-upload-new"
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleImageUpload(e, 'photo', 'new')}
                          disabled={uploadingImage !== null}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Account Info */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <Lock size={14} />
                      {t('account_security')}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('name')}</label>
                        <input
                          type="text"
                          required
                          value={newUser.nom}
                          onChange={(e) => setNewUser({...newUser, nom: e.target.value})}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('firstname')}</label>
                        <input
                          type="text"
                          required
                          value={newUser.prenom}
                          onChange={(e) => setNewUser({...newUser, prenom: e.target.value})}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('email')}</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="email"
                          required
                          value={newUser.email}
                          onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5 ml-1">
                        <label className="block text-xs font-medium text-gray-500 uppercase">{t('password')}</label>
                        <button 
                          type="button" 
                          onClick={generatePassword}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 uppercase"
                        >
                          <Key size={10} /> {t('generate')}
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          minLength={6}
                          value={newUser.password}
                          onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                          className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Personal Info */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <User size={14} />
                      {t('personal_info')}
                    </h4>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('id_number')}</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          value={newUser.matricule}
                          onChange={(e) => setNewUser({...newUser, matricule: e.target.value})}
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('birth_date')}</label>
                        <input
                          type="date"
                          value={newUser.dateNaissance}
                          onChange={(e) => setNewUser({...newUser, dateNaissance: e.target.value})}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('birth_place')}</label>
                        <input
                          type="text"
                          value={newUser.lieuNaissance}
                          onChange={(e) => setNewUser({...newUser, lieuNaissance: e.target.value})}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('contact')}</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="text"
                            value={newUser.contact}
                            onChange={(e) => setNewUser({...newUser, contact: e.target.value})}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('address')}</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="text"
                            value={newUser.address}
                            onChange={(e) => setNewUser({...newUser, address: e.target.value})}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('gender')}</label>
                        <select
                          value={newUser.gender}
                          onChange={(e) => setNewUser({...newUser, gender: e.target.value as any})}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        >
                          <option value="not_specified">{t('not_specified')}</option>
                          <option value="male">{t('male')}</option>
                          <option value="female">{t('female')}</option>
                          <option value="other">{t('other')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('age')}</label>
                        <input
                          type="number"
                          value={newUser.age}
                          onChange={(e) => setNewUser({...newUser, age: e.target.value})}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Briefcase size={14} />
                    {t('prof_profile_role')}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('diploma')}</label>
                          <div className="relative">
                            <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                              type="text"
                              value={newUser.diploma}
                              onChange={(e) => setNewUser({...newUser, diploma: e.target.value})}
                              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('experience_years')}</label>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                              type="number"
                              value={newUser.experience_years}
                              onChange={(e) => setNewUser({...newUser, experience_years: e.target.value})}
                              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('role')}</label>
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        >
                          <option value="élève">{tData('élève')}</option>
                          <option value="enseignant">{tData('enseignant')}</option>
                          <option value="personnel administratif">{tData('personnel administratif')}</option>
                          <option value="cuisinier">{tData('cuisinier')}</option>
                          {isSuperAdmin && (
                            <option value="admin">Administrateur d'Établissement ({tData('admin')})</option>
                          )}
                        </select>
                      </div>

                      {isSuperAdmin && (
                        <div>
                          <label className="block text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1.5 ml-1 uppercase font-bold text-[11px] tracking-wide">🏫 Établissement de rattachement</label>
                          <select
                            required
                            value={newUser.etablissement || currentEstablishment?.id || ''}
                            onChange={(e) => setNewUser({...newUser, etablissement: e.target.value})}
                            className="w-full px-4 py-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold text-indigo-900 dark:text-indigo-300"
                          >
                            <option value="">Sélectionner un établissement</option>
                            {establishments.map(est => (
                              <option key={est.id} value={est.id}>{est.id} - {est.nom}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {newUser.role === 'élève' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('class')}</label>
                            <select
                              required
                              value={newUser.classe}
                              onChange={(e) => setNewUser({...newUser, classe: e.target.value})}
                              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                            >
                              <option value="">{t('select_class')}</option>
                              {classes.map(cls => (
                                <option key={cls.id} value={cls.nom}>{cls.nom}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">{t('house_optional')}</label>
                            <select
                              value={newUser.house_id || ''}
                              onChange={(e) => setNewUser({...newUser, house_id: e.target.value})}
                              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                            >
                              <option value="">{t('no_house')}</option>
                              {houses.map(house => (
                                <option key={house.id} value={house.id}>{house.nom_maison}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {newUser.role === 'personnel administratif' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 uppercase">Responsabilité / Poste</label>
                          <select
                            required
                            value={newUser.position}
                            onChange={(e) => setNewUser({...newUser, position: e.target.value})}
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                          >
                            <option value="">Sélectionner une responsabilité</option>
                            <option value="responsable collège">Responsable collège</option>
                            <option value="responsable primaire">Responsable primaire</option>
                            <option value="responsable maternelle">Responsable maternelle</option>
                            <option value="secrétaire générale">Secrétaire générale</option>
                            <option value="secrétaire adjoint">Secrétaire adjoint</option>
                            <option value="surveillant">Surveillant</option>
                            <option value="comptable">Comptable</option>
                            <option value="chargé pédagogique">Chargé pédagogique</option>
                          </select>
                        </div>
                      )}

                      {newUser.role === 'enseignant' && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-2 ml-1 uppercase">{t('subjects')}</label>
                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50">
                              {subjects.length > 0 ? (
                                subjects.map(subj => (
                                  <label key={subj.id} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                                    <input
                                      type="checkbox"
                                      checked={(newUser.matieres || []).includes(subj.name)}
                                      onChange={(e) => {
                                        const currentSubjects = newUser.matieres || [];
                                        if (e.target.checked) {
                                          setNewUser({...newUser, matieres: [...currentSubjects, subj.name]});
                                        } else {
                                          setNewUser({...newUser, matieres: currentSubjects.filter((s: string) => s !== subj.name)});
                                        }
                                      }}
                                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs text-gray-700 dark:text-gray-300">{subj.name}</span>
                                  </label>
                                ))
                              ) : (
                                <p className="text-xs text-gray-500 col-span-full p-2 italic">Aucune matière trouvée dans le répertoire.</p>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-2 ml-1 uppercase">{t('assigned_classes')}</label>
                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50">
                              {classes.map(cls => (
                                <label key={cls.id} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={(newUser.classes || []).includes(cls.nom)}
                                    onChange={(e) => {
                                      const currentClasses = newUser.classes || [];
                                      if (e.target.checked) {
                                        setNewUser({...newUser, classes: [...currentClasses, cls.nom]});
                                      } else {
                                        setNewUser({...newUser, classes: currentClasses.filter((c: string) => c !== cls.nom)});
                                      }
                                    }}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="text-xs text-gray-700 dark:text-gray-300">{cls.nom}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-sm transition-all shadow-sm"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="animate-spin" size={18} /> : null}
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      <SuccessModal 
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        title={successInfo.title}
        message={successInfo.message}
      />
    </div>
  );
}
