import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  Users, 
  Search, 
  UserPlus, 
  Mail, 
  Phone, 
  Shield, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  Scale,
  Briefcase,
  MapPin,
  Calendar,
  Filter,
  GraduationCap,
  Laptop,
  Sparkles,
  BookOpen,
  Wallet,
  FileBadge,
  ShieldAlert,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import RoleResponsibilities from '../components/RoleResponsibilities';

// The 11 specific administrative roles/responsibilities defined by the user
export const administrativeResponsibilities = [
  { id: 'responsable_maternelle', label: 'Responsable de la Maternelle', color: 'pink', badgeBg: 'bg-pink-50 border-pink-100 dark:bg-pink-950/20 text-pink-700 dark:text-pink-350 dark:border-pink-900/30' },
  { id: 'responsable_primaire', label: 'Responsable du Primaire', color: 'sky', badgeBg: 'bg-sky-50 border-sky-100 dark:bg-sky-950/20 text-sky-700 dark:text-sky-350 dark:border-sky-900/30' },
  { id: 'responsable_college', label: 'Responsable Collège', color: 'indigo', badgeBg: 'bg-indigo-50 border-indigo-100 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-350 dark:border-indigo-900/30' },
  { id: 'gestionnaire_comptable', label: 'Gestionnaire Comptable', color: 'emerald', badgeBg: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-350 dark:border-emerald-900/30' },
  { id: 'responsable_pedagogique', label: 'Responsable Pédagogique', color: 'amber', badgeBg: 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 text-amber-700 dark:text-amber-350 dark:border-amber-900/30' },
  { id: 'surveillant_general', label: 'Surveillant Général', color: 'red', badgeBg: 'bg-red-50 border-red-100 dark:bg-red-950/20 text-red-700 dark:text-red-350 dark:border-red-900/30' },
  { id: 'surveillant_adjoint', label: 'Surveillant Adjoint', color: 'orange', badgeBg: 'bg-orange-50 border-orange-100 dark:bg-orange-950/20 text-orange-750 dark:text-orange-350 dark:border-orange-900/30' },
  { id: 'dame_menage', label: 'Dame de Ménage', color: 'teal', badgeBg: 'bg-teal-50 border-teal-100 dark:bg-teal-950/20 text-teal-750 dark:text-teal-350 dark:border-teal-900/30' },
  { id: 'secretaire_generale', label: 'Secrétaire Générale', color: 'purple', badgeBg: 'bg-purple-50 border-purple-100 dark:bg-purple-950/20 text-purple-700 dark:text-purple-350 dark:border-purple-900/30' },
  { id: 'secretaire_adjointe', label: 'Secrétaire Adjointe', color: 'fuchsia', badgeBg: 'bg-fuchsia-50 border-fuchsia-100 dark:bg-fuchsia-950/20 text-fuchsia-700 dark:text-fuchsia-350 dark:border-fuchsia-900/30' },
  { id: 'responsable_it', label: 'Responsable du Matériel Informatique', color: 'cyan', badgeBg: 'bg-cyan-50 border-cyan-100 dark:bg-cyan-950/20 text-cyan-700 dark:text-cyan-350 dark:border-cyan-900/30' }
];

interface StaffUser {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  phone?: string;
  role: string;
  status?: string;
  lastSeen?: any;
  photo?: string;
  department?: string;
  position?: string;
  contact?: string;
  address?: string;
  gender?: string;
  age?: number;
  responsibilities?: string[];
}

export default function Staff() {
  const { t, tData, language } = useLanguage();
  const { notifySuccess, notifyError, notifyDelete } = useNotification();
  const { currentUser } = useAuth();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'personnel administratif' | 'enseignant' | 'cuisinier'>('all');
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'roles'>('roles'); // Default to roles to highlight the newly requested responsibilities layout!

  useEffect(() => {
    // Specifically query for 'personnel administratif', 'cuisinier', and 'enseignant' to support dual responsibilities on teachers
    const q = query(
      collection(db, 'users'),
      where('role', 'in', ['personnel administratif', 'cuisinier', 'enseignant'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const staffData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StaffUser[];
      
      // Sort by name
      staffData.sort((a, b) => {
        const nameA = `${a.nom || ''} ${a.prenom || ''}`.trim().toLowerCase();
        const nameB = `${b.nom || ''} ${b.prenom || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      setStaff(staffData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching administrative staff & teachers:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredStaff = staff.filter(member => {
    const fullName = `${member.prenom || ''} ${member.nom || ''}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchesSearch = fullName.includes(search) || member.email?.toLowerCase().includes(search);
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleDeleteStaff = async (id: string) => {
    if (!window.confirm(t('staff_delete_confirm'))) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      notifyDelete("Personnel administratif supprimé.");
    } catch (error) {
      console.error("Error deleting staff member:", error);
      notifyError(t('error_occurred'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Scale size={24} />
            </div>
            {t('admin_staff')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('staff_mgmt_desc')}
          </p>
        </div>
      </div>

      {/* Sub-Tabs Switcher */}
      <div className="flex border-b border-gray-150 dark:border-gray-700/60 mb-6 bg-white dark:bg-gray-800 p-2 rounded-2xl gap-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveSubTab('roles')}
          className={`flex-1 sm:flex-initial text-center px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
            activeSubTab === 'roles'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-gray-900/40'
          }`}
        >
          Missions & Responsabilités par Page
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('directory')}
          className={`flex-1 sm:flex-initial text-center px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
            activeSubTab === 'directory'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-gray-900/40'
          }`}
        >
          Annuaire du Personnel & Attribution
        </button>
      </div>

      {activeSubTab === 'roles' ? (
        <RoleResponsibilities />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder={t('search_staff_placeholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 text-sm outline-none transition-all shadow-sm"
                />
              </div>

              {/* Core Role Filters */}
              <div className="flex flex-wrap gap-1.5 self-start md:self-auto w-full md:w-auto">
                {(['all', 'personnel administratif', 'enseignant', 'cuisinier'] as const).map((roleKey) => {
                  let label = "Tous";
                  if (roleKey === 'personnel administratif') label = "Administration";
                  if (roleKey === 'enseignant') label = "Enseignants";
                  if (roleKey === 'cuisinier') label = "Cuisine";
                  
                  return (
                    <button
                      key={roleKey}
                      type="button"
                      onClick={() => setRoleFilter(roleKey)}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        roleFilter === roleKey
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                          : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-650 dark:text-gray-300 border border-transparent'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                  <th className="w-1/3 px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('staff_member')}</th>
                  <th className="w-1/4 px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('contact')}</th>
                  <th className="w-1/4 px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('department')}</th>
                  <th className="w-24 px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('status')}</th>
                  <th className="w-32 px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-medium">{t('loading_staff')}</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-3">
                        <Users size={40} className="text-gray-300" />
                        <p className="text-sm font-medium">{t('no_staff_found')}</p>
                        <p className="text-xs text-gray-400">{t('check_role_admin_staff')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {member.photo ? (
                            <img src={member.photo} alt="" className="w-10 h-10 rounded-xl object-cover shadow-sm" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase">
                              {member.prenom?.[0] || 'U'}{member.nom?.[0] || ''}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                              {member.prenom} {member.nom}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                                member.role === 'enseignant' 
                                  ? 'bg-purple-100 text-purple-750 dark:bg-purple-950/45 dark:text-purple-300 shadow-sm' 
                                  : member.role === 'cuisinier'
                                    ? 'bg-rose-100 text-rose-750 dark:bg-rose-950/45 dark:text-rose-300'
                                    : 'bg-indigo-100 text-indigo-750 dark:bg-indigo-950/45 dark:text-indigo-300'
                              }`}>
                                {tData(member.role)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 min-w-0 text-xs">
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-405 truncate">
                            <Mail size={12} className="shrink-0" />
                            <span className="truncate">{member.email}</span>
                          </div>
                          {(member.phone || member.contact) && (
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-405 truncate">
                              <Phone size={12} className="shrink-0" />
                              <span className="truncate">{member.phone || member.contact}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white font-medium truncate">{member.position || t('default_position')}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">{member.department || t('default_department')}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                          member.status === 'online' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {member.status === 'online' ? t('online') : t('inactive')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setSelectedStaff(member)}
                            className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                            title={t('view_details')}
                          >
                            <ExternalLink size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteStaff(member.id)}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                            title={t('delete')}
                          >
                            <Trash2 size={18} />
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

      {/* Staff Detail Modal */}
      <AnimatePresence>
        {selectedStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto overflow-x-hidden border border-white/20"
            >
              <div className="relative h-40 bg-gradient-to-br from-indigo-500 to-purple-600">
                <button 
                  onClick={() => setSelectedStaff(null)}
                  className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all backdrop-blur-md"
                >
                  <XCircle size={24} />
                </button>
              </div>
              <div className="px-8 pb-10">
                <div className="relative -mt-20 mb-8 flex justify-center">
                  <div className="relative">
                    {selectedStaff.photo ? (
                      <img 
                        src={selectedStaff.photo} 
                        alt="" 
                        className="w-40 h-40 rounded-[2rem] border-8 border-white dark:border-gray-800 object-cover shadow-2xl"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-40 h-40 rounded-[2rem] border-8 border-white dark:border-gray-800 bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-5xl font-black shadow-2xl">
                        {selectedStaff.prenom?.[0] || 'U'}{selectedStaff.nom?.[0] || ''}
                      </div>
                    )}
                    <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl border-4 border-white dark:border-gray-800 bg-green-500 shadow-lg flex items-center justify-center">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                    </div>
                  </div>
                </div>

                <div className="text-center space-y-6">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                      {selectedStaff.prenom} {selectedStaff.nom}
                    </h2>
                    <div className="flex items-center justify-center gap-2 mt-2">
                       <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-black uppercase tracking-widest rounded-full">
                        {tData(selectedStaff.role)}
                       </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-gray-50 dark:bg-gray-700/50 rounded-3xl border border-gray-100 dark:border-gray-600/50 transition-all hover:shadow-md">
                      <Briefcase className="text-indigo-500 mb-2" size={20} />
                      <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">{t('department')}</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedStaff.department || t('default_department')}</p>
                    </div>
                    <div className="p-5 bg-gray-50 dark:bg-gray-700/50 rounded-3xl border border-gray-100 dark:border-gray-600/50 transition-all hover:shadow-md">
                      <Shield className="text-purple-500 mb-2" size={20} />
                      <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">{t('position')}</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedStaff.position || t('default_position')}</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-2xl">
                      <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
                        <Mail size={18} className="text-indigo-500" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase text-gray-400 leading-none mb-1">{t('professional_email')}</p>
                        <p className="text-sm font-bold">{selectedStaff.email}</p>
                      </div>
                    </div>
                    {(selectedStaff.phone || selectedStaff.contact) && (
                      <div className="flex items-center gap-4 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-2xl">
                        <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
                          <Phone size={18} className="text-green-500" />
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-black uppercase text-gray-400 leading-none mb-1">{t('phone')}</p>
                          <p className="text-sm font-bold">{selectedStaff.phone || selectedStaff.contact}</p>
                        </div>
                      </div>
                    )}
                    {selectedStaff.address && (
                      <div className="flex items-center gap-4 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-2xl">
                        <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
                          <MapPin size={18} className="text-red-500" />
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-black uppercase text-gray-400 leading-none mb-1">{t('address')}</p>
                          <p className="text-sm font-bold truncate max-w-[250px]">{selectedStaff.address}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cumul des Responsabilités (Role Assignment) Section */}
                  {currentUser?.role === 'admin' ? (
                    <div className="bg-gray-50 dark:bg-gray-900/40 p-5 rounded-3xl border border-gray-150/60 dark:border-gray-750 text-left space-y-3">
                      <div className="flex items-center gap-2 text-indigo-650 dark:text-indigo-400">
                        <Shield size={16} />
                        <h4 className="text-xs font-black uppercase tracking-wider">
                          Cumul des Responsabilités
                        </h4>
                      </div>
                      <p className="text-[10px] text-gray-450 dark:text-gray-400 leading-relaxed">
                        Cochez les fonctions administratives cumulées par ce membre (les enseignants peuvent également porter des responsabilités de direction).
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                        {administrativeResponsibilities.map((resp) => {
                          const isAssigned = (selectedStaff.responsibilities || []).includes(resp.id);
                          return (
                            <label 
                              key={resp.id}
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                isAssigned 
                                  ? 'border-indigo-500 bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 shadow-sm ring-1 ring-indigo-50' 
                                  : 'border-gray-100 dark:border-gray-750 bg-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={async (e) => {
                                  const currentResps = selectedStaff.responsibilities || [];
                                  let updated: string[];
                                  if (e.target.checked) {
                                    updated = [...currentResps, resp.id];
                                  } else {
                                    updated = currentResps.filter(id => id !== resp.id);
                                  }
                                  
                                  const updatedStaffMember = { ...selectedStaff, responsibilities: updated };
                                  setSelectedStaff(updatedStaffMember);
                                  
                                  try {
                                    await updateDoc(doc(db, 'users', selectedStaff.id), {
                                      responsibilities: updated
                                    });
                                    setStaff(prev => prev.map(s => s.id === selectedStaff.id ? { ...s, responsibilities: updated } : s));
                                    notifySuccess("Responsabilités mises à jour !");
                                  } catch (err) {
                                    console.error("Failed to update responsibilities:", err);
                                    notifyError("Erreur lors de la mise à jour.");
                                  }
                                }}
                                className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="font-bold text-[11px] leading-tight flex-1">{resp.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    selectedStaff.responsibilities && selectedStaff.responsibilities.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-900/40 p-5 rounded-3xl border border-gray-150/60 dark:border-gray-750 text-left space-y-3">
                        <div className="flex items-center gap-2 text-indigo-650 dark:text-indigo-400">
                          <Briefcase size={16} />
                          <h4 className="text-xs font-black uppercase tracking-wider">
                            Fonctions Cumulées
                          </h4>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedStaff.responsibilities.map((respId) => {
                            const respInfo = administrativeResponsibilities.find(r => r.id === respId);
                            if (!respInfo) return null;
                            return (
                              <span 
                                key={respId}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${respInfo.badgeBg}`}
                              >
                                {respInfo.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )
                  )}

                  <button 
                    onClick={() => setSelectedStaff(null)}
                    className="w-full py-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-[2rem] font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-gray-200 dark:shadow-none"
                  >
                    {t('close_sheet')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
