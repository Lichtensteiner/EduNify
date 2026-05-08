import React, { useState, useEffect } from 'react';
import { FileText, Download, Mail, Printer, Calendar, RefreshCw, Play } from 'lucide-react';
import { collection, getDocs, addDoc, query, where, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function Reports() {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [teacherClasses, setTeacherClasses] = useState<string[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured || !currentUser) {
      setLoading(false);
      return;
    }

    let unsubscribeReports: () => void;

    const setupReports = async () => {
      let tClasses: string[] = [];
      
      // Si enseignant, récupérer d'abord ses classes
      if (currentUser.role === 'enseignant') {
        try {
          const classesQuery = query(collection(db, 'classes'), where('professeur_principal_id', '==', currentUser.id));
          const classesSnap = await getDocs(classesQuery);
          tClasses = classesSnap.docs.map(d => d.data().nom);
          setTeacherClasses(tClasses);
        } catch (error) {
          console.error("Erreur lors de la vérification des classes de l'enseignant:", error);
        }
      }

      const q = query(collection(db, 'reports'));
      unsubscribeReports = onSnapshot(q, (snap) => {
        let reportsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        // Si enseignant, filtrer les rapports pour ne voir que ceux de ses classes
        if (currentUser.role === 'enseignant') {
          reportsData = reportsData.filter(r => tClasses.includes(r.classe));
        }

        // Trier par date décroissante
        reportsData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setReports(reportsData);
        if (reportsData.length > 0) {
          setSelectedReportId(prev => {
            if (!prev || !reportsData.find(r => r.id === prev)) {
              return reportsData[0].id;
            }
            return prev;
          });
        }
        setLoading(false);
      }, (err) => {
        console.error("Erreur lors de la récupération des rapports:", err);
        setLoading(false);
      });
    };

    setupReports();

    return () => {
      if (unsubscribeReports) unsubscribeReports();
    };
  }, [currentUser]);

  const generateWeeklyReports = async () => {
    if (!isFirebaseConfigured) return;
    setGenerating(true);
    try {
      // 1. Calculer les dates de la semaine (Lundi à Vendredi)
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Dimanche, 1 = Lundi, etc.
      const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      
      const monday = new Date(now.setDate(diffToMonday));
      monday.setHours(0, 0, 0, 0);
      
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      friday.setHours(23, 59, 59, 999);

      const weekString = `Semaine du ${monday.toLocaleDateString('fr-FR')} au ${friday.toLocaleDateString('fr-FR')}`;

      // 2. Récupérer tous les utilisateurs
      const usersSnap = await getDocs(collection(db, 'users'));
      let users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // Si enseignant, ne générer que pour ses classes
      if (currentUser?.role === 'enseignant') {
        if (teacherClasses.length === 0) {
          alert("Vous n'êtes assigné à aucune classe en tant que professeur principal. Veuillez contacter un administrateur.");
          setGenerating(false);
          return;
        }
        
        users = users.filter(u => teacherClasses.includes(u.classe));
        
        if (users.length === 0) {
          alert(`Aucun élève n'est assigné à vos classes (${teacherClasses.join(', ')}). Vérifiez la page Utilisateurs.`);
          setGenerating(false);
          return;
        }
      }

      // 3. Récupérer toutes les présences de la semaine
      const mondayStr = monday.toISOString().split('T')[0];
      const fridayStr = friday.toISOString().split('T')[0];
      
      const attQuery = query(collection(db, 'attendance'), 
        where('date', '>=', mondayStr),
        where('date', '<=', fridayStr)
      );
      const attSnap = await getDocs(attQuery);
      const attendances = attSnap.docs.map(d => d.data() as any);

      // 4. Générer le rapport pour chaque utilisateur
      for (const user of users) {
        // Ignorer les admins/enseignants si on ne veut évaluer que les élèves/employés
        if (user.role === 'admin') continue;

        // Vérifier si le rapport existe déjà
        const existingReportQuery = query(collection(db, 'reports'), 
          where('user_id', '==', user.id),
          where('semaine', '==', weekString)
        );
        const existingSnap = await getDocs(existingReportQuery);
        
        const userAtts = attendances.filter(a => a.user_id === user.id);
        
        let presence = 0;
        let retards = 0;
        let absences = 0;
        const tableau = [];

        const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
        for (let i = 0; i < 5; i++) {
          const currentDate = new Date(monday);
          currentDate.setDate(monday.getDate() + i);
          const dateStr = currentDate.toISOString().split('T')[0];
          
          const dayAtt = userAtts.find(a => a.date === dateStr);
          
          if (dayAtt) {
            if (dayAtt.statut === 'Présent') presence++;
            if (dayAtt.statut === 'Retard') retards++;
            tableau.push({
              jour: days[i],
              date: dateStr,
              heure_arrivee: dayAtt.heure_arrivee || '-',
              heure_depart: dayAtt.heure_depart || '-',
              statut: dayAtt.statut
            });
          } else {
            // Si la date est passée, c'est une absence
            const isPast = currentDate < new Date();
            if (isPast) absences++;
            tableau.push({
              jour: days[i],
              date: dateStr,
              heure_arrivee: '-',
              heure_depart: '-',
              statut: isPast ? 'Absent' : '-'
            });
          }
        }

        let analyse = "Assiduité parfaite cette semaine. Continuez ainsi !";
        if (absences > 0) analyse = `Attention, ${absences} absence(s) enregistrée(s) cette semaine.`;
        else if (retards > 0) analyse = `Présence régulière mais ${retards} retard(s) à corriger.`;

        const reportData = {
          user_id: user.id,
          user_name: user.prenom || user.nom ? `${user.prenom || ''} ${user.nom || ''}`.trim() : user.email?.split('@')[0] || 'Utilisateur',
          user_email: user.email || '',
          classe: user.classe || '',
          semaine: weekString,
          resume: { jours_presence: presence, retards, absences },
          tableau_presence: tableau,
          analyse,
          timestamp: new Date().toISOString()
        };

        if (existingSnap.empty) {
          await addDoc(collection(db, 'reports'), reportData);
        } else {
          // Mettre à jour le rapport existant pour avoir les données en temps réel
          const docId = existingSnap.docs[0].id;
          await updateDoc(doc(db, 'reports', docId), reportData);
        }
      }
      
      alert("Les rapports ont été générés et mis à jour avec succès !");
    } catch (err: any) {
      console.error(err);
      alert("Une erreur est survenue lors de la génération des rapports: " + (err.message || err));
    } finally {
      setGenerating(false);
    }
  };

  const handleSendEmail = () => {
    if (!selectedReport) return;
    const subject = encodeURIComponent(`Rapport de présence - ${selectedReport.semaine}`);
    const body = encodeURIComponent(`Bonjour,

Voici le résumé de votre présence pour la ${selectedReport.semaine} :
- Jours de présence : ${selectedReport.resume?.jours_presence || 0}
- Retards : ${selectedReport.resume?.retards || 0}
- Absences : ${selectedReport.resume?.absences || 0}

Analyse : ${selectedReport.analyse}

Cordialement,
L'équipe Edu-Nify`);
    
    window.location.href = `mailto:${selectedReport.user_email || ''}?subject=${subject}&body=${body}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedReport = reports.find(r => r.id === selectedReportId);

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Rapports Hebdomadaires</h1>
          <p className="text-sm text-gray-500 mt-1">Générés automatiquement en fin de semaine</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {(currentUser?.role === 'admin' || currentUser?.role === 'enseignant') && (
            <button 
              onClick={generateWeeklyReports}
              disabled={generating}
              className="bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors shadow-sm flex-1 sm:flex-none"
            >
              {generating ? <RefreshCw size={18} className="animate-spin" /> : <Play size={18} />}
              <span className="whitespace-nowrap">Générer les rapports</span>
            </button>
          )}
          <button 
            onClick={handleSendEmail}
            disabled={!selectedReport}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 disabled:opacity-50 px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors shadow-sm flex-1 sm:flex-none"
          >
            <Mail size={18} />
            <span className="whitespace-nowrap">Envoyer</span>
          </button>
          <button 
            onClick={handlePrint}
            disabled={!selectedReport}
            className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors shadow-sm flex-1 sm:flex-none"
          >
            <Printer size={18} />
            <span className="whitespace-nowrap">Imprimer / PDF</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 print:block print:gap-0">
        {/* Sidebar for selecting reports */}
        <div className="w-full lg:w-80 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[400px] lg:h-[calc(100vh-12rem)] print:hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-semibold text-gray-900">Archives des rapports</h3>
            <div className="mt-3 relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <select className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm">
                <option>Semaine Actuelle</option>
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex justify-center p-8">
                <RefreshCw className="animate-spin text-indigo-600" size={24} />
              </div>
            ) : reports.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                Aucun rapport généré pour le moment. {!isFirebaseConfigured && "Veuillez configurer Firebase."}
              </div>
            ) : (
              reports.map(report => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReportId(report.id)}
                  className={`w-full text-left p-3 rounded-xl mb-1 transition-colors ${
                    selectedReportId === report.id 
                      ? 'bg-indigo-50 border border-indigo-100' 
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="font-medium text-gray-900 text-sm">{report.user_name || "Utilisateur"}</div>
                  <div className="text-xs text-gray-500 mt-1 flex justify-between">
                    <span>{report.semaine}</span>
                    <span className="text-indigo-600 font-medium">{report.resume?.jours_presence || 0}/5 j</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Report Preview */}
        <div id="printable-report" className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-8 overflow-y-auto h-[calc(100vh-12rem)] print:border-none print:shadow-none print:p-0 print:h-auto print:overflow-visible print:block">
          {selectedReport ? (
            <div className="max-w-3xl mx-auto">
              {/* Header */}
              <div className="border-b-2 border-indigo-600 pb-6 mb-8 flex flex-col md:flex-row justify-between items-center md:items-start text-center md:text-left gap-4">
                <div className="flex flex-col items-center md:items-start">
                  <div className="flex items-center gap-3 mb-2">
                    <img src="/logo.png" alt="Edu-Nify" className="h-16 object-contain" />
                  </div>
                  <div className="text-[10px] text-gray-500 space-y-0.5">
                    <p className="font-bold text-gray-800 text-xs">Ecole Internationale Du Centre Pédagogique Edu-Nify</p>
                    <p>529 Avenue Félix HOUPHOUËT-BOIGNY, Trois Quartier, Libreville GABON</p>
                    <p>Contact: +241 011 44 9292 / 062 24 8425 / 077022307 / 062641120</p>
                    <p>Email: ludo.consulting3@gmail.com</p>
                  </div>
                </div>
                <div className="md:text-right">
                  <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">Rapport de Présence</h1>
                  <p className="text-gray-500 mt-1">{selectedReport.semaine}</p>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-emerald-600 mb-1">{selectedReport.resume?.jours_presence || 0}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Jours Présent</p>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-amber-500 mb-1">{selectedReport.resume?.retards || 0}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Retards</p>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-red-500 mb-1">{selectedReport.resume?.absences || 0}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Absences</p>
                </div>
              </div>

              {/* Table */}
              <h3 className="text-lg font-bold text-gray-900 mb-4">Détail des pointages</h3>
              <div className="border border-gray-200 rounded-xl overflow-x-auto mb-8">
                <table className="w-full text-sm text-left min-w-[600px]">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3">Jour</th>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Heure d'arrivée</th>
                      <th className="px-6 py-3">Heure de départ</th>
                      <th className="px-6 py-3 text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedReport.tableau_presence?.map((row: any, idx: number) => (
                      <tr key={idx} className="bg-white">
                        <td className="px-6 py-3 font-medium text-gray-900">{row.jour}</td>
                        <td className="px-6 py-3 text-gray-500">{row.date}</td>
                        <td className="px-6 py-3 font-mono text-gray-600">{row.heure_arrivee}</td>
                        <td className="px-6 py-3 font-mono text-gray-600">{row.heure_depart}</td>
                        <td className="px-6 py-3 text-right">
                          <span className={`font-medium ${
                            row.statut === 'Présent' ? 'text-emerald-600' :
                            row.statut === 'Retard' ? 'text-amber-600' :
                            'text-red-600'
                          }`}>
                            {row.statut}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Analysis */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-6">
                <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <FileText size={16} />
                  Analyse Automatique
                </h3>
                <p className="text-indigo-800 leading-relaxed italic">
                  "{selectedReport.analyse}"
                </p>
              </div>
              
              <div className="mt-12 text-center text-xs text-gray-400">
                Document généré automatiquement par le système Edu-Nify le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 flex-col gap-4">
              <FileText size={48} className="text-gray-200" />
              <p>Sélectionnez un rapport pour le visualiser</p>
              {!isFirebaseConfigured && <p className="text-sm">Firebase n'est pas encore configuré.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
