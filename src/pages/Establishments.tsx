import React, { useState } from 'react';
import { useEstablishment, Establishment } from '../contexts/EstablishmentContext';
import { 
  Building2, Plus, Edit2, ShieldAlert, CheckCircle, RefreshCw, 
  MapPin, Phone, Mail, Globe, Calendar, Key, Award, 
  Sliders, Search, Layout, Check, Palette, CreditCard, Ban
} from 'lucide-react';

export default function Establishments() {
  const { 
    establishments, 
    createEstablishment, 
    updateEstablishment, 
    toggleEstablishmentStatus,
    activeEstablishmentId,
    changeActiveEstablishment,
    isSuperAdmin
  } = useEstablishment();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEst, setEditingEst] = useState<Establishment | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formId, setFormId] = useState('');
  const [formNom, setFormNom] = useState('');
  const [formLogo, setFormLogo] = useState('');
  const [formBanner, setFormBanner] = useState('');
  const [formDevise, setFormDevise] = useState('');
  const [formAdresse, setFormAdresse] = useState('');
  const [formTelephone, setFormTelephone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSiteWeb, setFormSiteWeb] = useState('');
  const [formLicence, setFormLicence] = useState('');
  const [formPlan, setFormPlan] = useState<'Basic' | 'Standard' | 'Premium' | 'Enterprise'>('Standard');
  const [formPrimaryColor, setFormPrimaryColor] = useState('#4f46e5');
  const [formSecondaryColor, setFormSecondaryColor] = useState('#ea580c');
  const [formActiveSchoolYear, setFormActiveSchoolYear] = useState('2025-2026');

  const plansList = ['Basic', 'Standard', 'Premium', 'Enterprise'];
  const planPrices = {
    Basic: 99,
    Standard: 249,
    Premium: 499,
    Enterprise: 999
  };

  const handleOpenCreate = () => {
    setEditingEst(null);
    setFormId(`EDU-00${establishments.length + 1}`);
    setFormNom('');
    setFormLogo('https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=120&auto=format&fit=crop&q=60');
    setFormBanner('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=60');
    setFormDevise('Discipline, Excellence, Avenir');
    setFormAdresse('');
    setFormTelephone('');
    setFormEmail('');
    setFormSiteWeb('');
    setFormLicence(`EDUNIFY-LUDO-NEW-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormPlan('Standard');
    setFormPrimaryColor('#4f46e5');
    setFormSecondaryColor('#ea580c');
    setFormActiveSchoolYear('2025-2026');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (est: Establishment) => {
    setEditingEst(est);
    setFormId(est.id);
    setFormNom(est.nom);
    setFormLogo(est.logo || '');
    setFormBanner(est.banner || '');
    setFormDevise(est.devise || '');
    setFormAdresse(est.adresse || '');
    setFormTelephone(est.telephone || '');
    setFormEmail(est.email || '');
    setFormSiteWeb(est.siteWeb || '');
    setFormLicence(est.licence || '');
    setFormPlan(est.plan || 'Standard');
    setFormPrimaryColor(est.primaryColor || '#4f46e5');
    setFormSecondaryColor(est.secondaryColor || '#ea580c');
    setFormActiveSchoolYear(est.activeSchoolYear || '2025-2026');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formNom.trim()) {
      setFormError('L\'identifiant unique et le nom de l\'établissement sont requis.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingEst) {
        await updateEstablishment(editingEst.id, {
          nom: formNom,
          logo: formLogo,
          banner: formBanner,
          devise: formDevise,
          adresse: formAdresse,
          telephone: formTelephone,
          email: formEmail,
          siteWeb: formSiteWeb,
          licence: formLicence,
          plan: formPlan,
          primaryColor: formPrimaryColor,
          secondaryColor: formSecondaryColor,
          activeSchoolYear: formActiveSchoolYear
        });
      } else {
        // Enforce uniqueness of ID for creation
        if (establishments.some(e => e.id.toLowerCase() === formId.toLowerCase())) {
          throw new Error('Cet Identifiant unique d\'établissement est déjà utilisé.');
        }
        await createEstablishment({
          id: formId.toUpperCase().trim(),
          code: formId.toUpperCase().trim(),
          nom: formNom,
          logo: formLogo,
          banner: formBanner,
          devise: formDevise,
          adresse: formAdresse,
          telephone: formTelephone,
          email: formEmail,
          siteWeb: formSiteWeb,
          active: true,
          licence: formLicence,
          plan: formPlan,
          primaryColor: formPrimaryColor,
          secondaryColor: formSecondaryColor,
          activeSchoolYear: formActiveSchoolYear
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Une erreur est survenue lors de l\'enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // SaaS Statistics aggregations
  const totalCampuses = establishments.length;
  const activeCampuses = establishments.filter(e => e.active).length;
  const suspendedCampuses = totalCampuses - activeCampuses;
  
  // Calculate dynamic SaaS monthly recurring revenue (MRR)
  const estimatedMRR = establishments
    .filter(e => e.active)
    .reduce((sum, e) => sum + (planPrices[e.plan] || 0), 0);

  // Filters
  const filteredList = establishments.filter(est => {
    const matchesSearch = est.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          est.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          est.devise.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = filterPlan === 'all' || est.plan === filterPlan;
    const matchesStatus = filterStatus === 'all' || 
                          (filterStatus === 'active' && est.active) || 
                          (filterStatus === 'inactive' && !est.active);
    return matchesSearch && matchesPlan && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Banner Title */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center justify-center pointer-events-none p-5">
          <Building2 size={180} />
        </div>
        <div className="relative z-10 space-y-2">
          <span className="text-[10px] bg-indigo-500/30 text-indigo-300 font-extrabold uppercase px-2.5 py-1 rounded-full border border-indigo-400/25 tracking-wider">
            SaaS Platform - Management Control Center
          </span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            Edu-Nify Multi-Tenancy Core
          </h1>
          <p className="text-gray-300 text-xs md:text-sm font-medium max-w-2xl">
            Supervisez tous les campus et centres de formation rattachés à la plateforme. Créez des instances isolées, surveillez les licences actives et gérez l'application globale de la charte graphique de chaque client.
          </p>
        </div>
      </div>

      {/* SaaS Statistics Metrics Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total subscription campus count */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Building2 size={24} />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block">Total Campus</span>
            <span className="text-xl font-black text-gray-800 dark:text-gray-100">{totalCampuses} Établissements</span>
          </div>
        </div>

        {/* Active systems count */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle size={24} />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block">SaaS Académiques Actifs</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-450">{activeCampuses} opérationnels</span>
          </div>
        </div>

        {/* Suspended systems count */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 dark:bg-red-950/45 text-red-650 dark:text-red-400 rounded-xl">
            <ShieldAlert size={24} />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block">Campus Suspendus</span>
            <span className="text-xl font-black text-red-600 dark:text-red-400">{suspendedCampuses} hors-ligne</span>
          </div>
        </div>

        {/* Financial MRR from subscription plans */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
            <CreditCard size={24} />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block">SaaS MRR récurrent</span>
            <span className="text-xl font-black text-gray-850 dark:text-white">{estimatedMRR.toLocaleString("fr-FR")} € / mois</span>
          </div>
        </div>
      </div>

      {/* Control Actions & Searching */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-850 p-4 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-sm">
        {/* Search Input bar */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom d'établissement, code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold outline-none text-gray-850 dark:text-white"
          />
        </div>

        {/* Selection Dropdowns for filtering */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Plan Filter */}
          <select
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-black text-gray-800 dark:text-gray-300"
          >
            <option value="all">Tous les abonnements</option>
            {plansList.map(plan => (
              <option key={plan} value={plan}>{plan}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-black text-gray-800 dark:text-gray-300"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="inactive">Suspendu</option>
          </select>

          {/* Create action button */}
          {isSuperAdmin && (
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              Nouveau Campus
            </button>
          )}
        </div>
      </div>

      {/* Grid of establishments cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredList.map((est) => {
          const isCurrentActive = activeEstablishmentId === est.id;

          return (
            <div 
              key={est.id} 
              className={`bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border transition-all duration-300 relative shadow-sm hover:shadow-md ${
                isCurrentActive 
                  ? 'border-indigo-650 dark:border-indigo-500 shadow-indigo-200/50 dark:shadow-none' 
                  : 'border-gray-150 dark:border-gray-850'
              }`}
            >
              {/* Banner Cover picture */}
              <div className="h-28 relative overflow-hidden bg-slate-900">
                {est.banner ? (
                  <img src={est.banner} alt={est.nom} className="w-full h-full object-cover opacity-80" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-slate-950" />
                )}
                
                {/* ID and Status badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-md bg-black/50 backdrop-blur-md text-[10px] font-black text-white uppercase tracking-wider">
                    {est.id}
                  </span>
                  
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-wider uppercase flex items-center gap-1 ${
                    est.active 
                      ? 'bg-emerald-550/90 text-white shadow-md' 
                      : 'bg-red-600 text-white shadow-md'
                  }`}>
                    {est.active ? 'Actif' : 'Suspendu'}
                  </span>
                </div>

                {/* Sub Plan badge */}
                <div className="absolute top-3 right-3">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wide flex items-center gap-1 ${
                    est.plan === 'Enterprise' ? 'bg-indigo-600 text-white' :
                    est.plan === 'Premium' ? 'bg-cyan-600 text-white' :
                    est.plan === 'Standard' ? 'bg-amber-650 text-white' :
                    'bg-gray-650 text-white'
                  }`}>
                    <Award size={10} />
                    {est.plan} ({planPrices[est.plan]}€/m)
                  </span>
                </div>
              </div>

              {/* Logo icon & Title */}
              <div className="p-6 pt-0 relative flex flex-col">
                {/* Floating Logo sphere */}
                <div className="-mt-9 mb-3 ml-2 flex items-end justify-between">
                  {est.logo ? (
                    <img 
                      src={est.logo} 
                      alt="Logo" 
                      className="w-16 h-16 rounded-2xl bg-white dark:bg-gray-900 border-2 border-white dark:border-gray-800 shadow-md object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900 border-2 border-white dark:border-gray-800 shadow-md flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-lg">
                      {est.id.slice(0, 3)}
                    </div>
                  )}

                  {/* Switch Active simulation context */}
                  {isSuperAdmin && est.active && (
                    <button
                      onClick={() => changeActiveEstablishment(est.id)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                        isCurrentActive 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/20 dark:border-indigo-900 dark:text-indigo-400' 
                          : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-900 dark:hover:bg-gray-850 dark:border-gray-800 dark:text-gray-450'
                      }`}
                    >
                      {isCurrentActive ? '● Charte active' : 'Visualiser le campus'}
                    </button>
                  )}
                </div>

                {/* College Information text */}
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white line-clamp-1">
                    {est.nom}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold italic line-clamp-1">
                    « {est.devise || 'Pas de devise configurée'} »
                  </p>
                </div>

                {/* Institutional Colors Scheme Preview */}
                <div className="mt-4 flex items-center gap-3 bg-gray-50 dark:bg-gray-850 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800/80">
                  <Palette size={14} className="text-gray-400" />
                  <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Charte graphique :</span>
                  <div className="flex gap-1.5 items-center">
                    <span 
                      className="w-4 h-4 rounded-full border border-white dark:border-gray-900" 
                      style={{ backgroundColor: est.primaryColor }}
                      title="Couleur Principale"
                    />
                    <span 
                      className="w-4 h-4 rounded-full border border-white dark:border-gray-900" 
                      style={{ backgroundColor: est.secondaryColor }}
                      title="Couleur Secondaire"
                    />
                  </div>
                </div>

                {/* Meta list of details */}
                <div className="mt-4 border-t border-gray-150 dark:border-gray-850 pt-4 space-y-2 text-[11px] text-gray-650 dark:text-gray-300 font-bold">
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-gray-400 shrink-0" />
                    <span className="line-clamp-1">{est.adresse || 'Adresse non spécifiée'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-gray-400" />
                    <span>{est.telephone || 'Téléphone non spécifié'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="text-gray-400" />
                    <span className="line-clamp-1">{est.email || 'Email non spécifié'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-indigo-50/20 dark:bg-indigo-950/10 p-2 rounded-xl mt-3 text-xs border border-dashed border-indigo-150/40 dark:border-indigo-900/30">
                    <div className="flex items-center gap-1.5 font-bold text-gray-500 dark:text-gray-400 text-[10px]">
                      <Key size={12} />
                      LICENCE : {est.licence ? `${est.licence.slice(0, 12)}...` : 'N/A'}
                    </div>
                    <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-extrabold uppercase">
                      Année {est.activeSchoolYear}
                    </span>
                  </div>
                </div>

                {/* Edit & Suspension actions */}
                {isSuperAdmin && (
                  <div className="mt-5 pt-4 border-t border-gray-150 dark:border-gray-850 flex gap-2">
                    <button
                      onClick={() => handleOpenEdit(est)}
                      className="p-2 aspect-square rounded-xl bg-gray-55/60 hover:bg-gray-100 dark:bg-gray-750 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all cursor-pointer"
                      title="Modifier les réglages et design"
                    >
                      <Edit2 size={14} />
                    </button>

                    <button
                      onClick={() => toggleEstablishmentStatus(est.id)}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        est.active 
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-650 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 dark:text-rose-400' 
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-650 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/40 dark:text-emerald-400'
                      }`}
                    >
                      {est.active ? (
                        <>
                          <Ban size={12} />
                          Suspendre
                        </>
                      ) : (
                        <>
                          <CheckCircle size={12} />
                          Réactiver campus
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredList.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-800 rounded-3xl text-gray-400">
            <Building2 size={40} className="mx-auto mb-3" />
            <p className="text-xs font-black uppercase tracking-wider">Aucun campus ne correspond à vos filtres.</p>
          </div>
        )}
      </div>

      {/* CREATION / MODIFICATION DIALOG MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isSubmitting && setIsModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="p-6 border-b border-gray-150 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  {editingEst ? "Modifier l'établissement" : "Enregistrer un nouvel établissement"}
                </h3>
              </div>
              <button
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                className="p-1 text-gray-450 hover:text-gray-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Error banner */}
            {formError && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/30 text-red-650 dark:text-red-400 text-xs font-bold text-center">
                {formError}
              </div>
            )}

            {/* Form body */}
            <form onSubmit={handleSave} className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* ID Input */}
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">ID Unique (tenant ID)</label>
                  <input
                    type="text"
                    disabled={!!editingEst}
                    placeholder="EDU-001"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-extrabold tracking-wider disabled:opacity-50 text-gray-850 dark:text-white"
                  />
                </div>

                {/* Target Name */}
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Nom de l'établissement</label>
                  <input
                    type="text"
                    placeholder="e.g. Institut Polytechnique"
                    value={formNom}
                    onChange={(e) => setFormNom(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-extrabold text-gray-850 dark:text-white"
                  />
                </div>
              </div>

              {/* Moto / Devise */}
              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Devise / Slogan institutionnel</label>
                <input
                  type="text"
                  placeholder="e.g. Discipline, Travail, Succès"
                  value={formDevise}
                  onChange={(e) => setFormDevise(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-bold text-gray-850 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Logo URL */}
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 font-bold">Logo (Image URL)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formLogo}
                    onChange={(e) => setFormLogo(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-semibold text-gray-850 dark:text-white"
                  />
                </div>

                {/* Banner URL */}
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 font-bold">Bannière (Image URL)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formBanner}
                    onChange={(e) => setFormBanner(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-semibold text-gray-850 dark:text-white"
                  />
                </div>
              </div>

              {/* Branding Custom Colors */}
              <div className="p-4 bg-gray-50 dark:bg-gray-950/20 border border-gray-200 dark:border-gray-850 rounded-2xl">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">
                  Couleurs institutionnelles (Charte graphique)
                </span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-extrabold text-gray-400 uppercase mb-1">Couleur Principale</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formPrimaryColor}
                        onChange={(e) => setFormPrimaryColor(e.target.value)}
                        className="w-9 h-9 rounded-lg border-0 cursor-pointer overflow-hidden p-0"
                      />
                      <input
                        type="text"
                        value={formPrimaryColor}
                        onChange={(e) => setFormPrimaryColor(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg outline-none text-xs font-mono font-black"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-gray-400 uppercase mb-1">Couleur Secondaire</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formSecondaryColor}
                        onChange={(e) => setFormSecondaryColor(e.target.value)}
                        className="w-9 h-9 rounded-lg border-0 cursor-pointer overflow-hidden p-0"
                      />
                      <input
                        type="text"
                        value={formSecondaryColor}
                        onChange={(e) => setFormSecondaryColor(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg outline-none text-xs font-mono font-black"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* License, Plan and active school year */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Plan de souscription</label>
                  <select
                    value={formPlan}
                    onChange={(e) => setFormPlan(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-bold text-gray-850 dark:text-white"
                  >
                    {plansList.map(plan => (
                      <option key={plan} value={plan}>{plan} ({planPrices[plan]}€/mois)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Licence Edu-Nify</label>
                  <input
                    type="text"
                    value={formLicence}
                    onChange={(e) => setFormLicence(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-mono font-bold text-gray-850 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Année Active</label>
                  <input
                    type="text"
                    placeholder="2025-2026"
                    value={formActiveSchoolYear}
                    onChange={(e) => setFormActiveSchoolYear(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-black text-gray-850 dark:text-white"
                  />
                </div>
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Téléphone d'accueil</label>
                  <input
                    type="text"
                    placeholder="+241 ..."
                    value={formTelephone}
                    onChange={(e) => setFormTelephone(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-extrabold text-gray-850 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Email global</label>
                  <input
                    type="email"
                    placeholder="direction@..."
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-extrabold text-gray-850 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Site Web institutionnel</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formSiteWeb}
                    onChange={(e) => setFormSiteWeb(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-extrabold text-gray-850 dark:text-white"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Adresse Physique complete</label>
                <input
                  type="text"
                  placeholder="Quartier Sablière, face à la plage, Libreville"
                  value={formAdresse}
                  onChange={(e) => setFormAdresse(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-bold text-gray-850 dark:text-white"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-150 dark:border-gray-850">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-200 dark:shadow-none"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
