import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, where, doc, getDoc } from 'firebase/firestore';
import { 
  FileText, 
  Download, 
  Users, 
  GraduationCap, 
  IdCard, 
  CheckCircle2, 
  Search,
  FileCheck,
  QrCode,
  FileBadge
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

interface Student {
  id: string;
  nom: string;
  prenom: string;
  matricule?: string;
  classId?: string;
  className?: string;
  mainTeacher?: string;
  photo?: string;
  role?: string;
  email?: string;
  contact?: string;
  address?: string;
  gender?: string;
  age?: string | number;
  house_id?: string;
  houseName?: string;
  dateNaissance?: string;
  lieuNaissance?: string;
}

export default function DocumentGenerator() {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [teachers, setTeachers] = useState<{id: string, name: string}[]>([]);
  
  // Customization state
  const [editDoc, setEditDoc] = useState<{
    type: 'card' | 'cert' | 'report';
    student: Student;
    config: any;
  } | null>(null);

  useEffect(() => {
    // Pre-load logo
    const loadLogo = async () => {
      try {
        const dataUrl = await getImageDataUrl('/logo.png');
        setLogoDataUrl(dataUrl);
      } catch (e) {
        console.warn("Could not pre-load logo", e);
      }
    };
    loadLogo();
  }, []);

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        // Fetch all classes first
        const classesSnapshot = await getDocs(collection(db, 'classes'));
        const classesData = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        const classesMap = new Map();
        
        // Fetch all houses
        const housesSnapshot = await getDocs(collection(db, 'houses'));
        const housesMap = new Map();
        housesSnapshot.forEach(doc => {
          housesMap.set(doc.id, doc.data().nom_maison);
        });

        // Fetch all teachers to resolve main teacher names
        const teachersSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'enseignant')));
        const teachersList: {id: string, name: string}[] = [];
        const teachersMap = new Map();
        teachersSnapshot.forEach(doc => {
          const data = doc.data();
          const name = `${data.prenom || ''} ${data.nom || ''}`.trim();
          teachersMap.set(doc.id, name);
          teachersList.push({ id: doc.id, name });
        });
        setTeachers(teachersList);

        const classesList: {id: string, name: string}[] = [];
        classesData.forEach((cls: any) => {
          classesList.push({ id: cls.id, name: cls.nom });
          classesMap.set(cls.id, {
            name: cls.nom,
            mainTeacher: cls.professeur_principal_id ? teachersMap.get(cls.professeur_principal_id) : 'Non assigné'
          });
        });
        setClasses(classesList);

        // Fetch students
        const q = query(collection(db, 'users'), where('role', '==', 'élève'));
        const snapshot = await getDocs(q);
        
        const studentsList = snapshot.docs.map(doc => {
          const data = doc.data();
          const classInfo = data.classId ? classesMap.get(data.classId) : null;
          return { 
            id: doc.id, 
            ...data,
            className: classInfo ? classInfo.name : (data.className || 'Non assignée'),
            mainTeacher: classInfo ? classInfo.mainTeacher : 'Non assigné',
            houseName: data.house_id ? housesMap.get(data.house_id) : 'N/A'
          } as Student;
        });

        setStudents(studentsList);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  // Helper to get image data URL
  const getImageDataUrl = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const drawLogo = async (doc: jsPDF, x: number, y: number, size: number = 15) => {
    try {
      const imgData = logoDataUrl || await getImageDataUrl('/logo.png');
      doc.addImage(imgData, 'PNG', x, y, size, size);
    } catch (e) {
      console.warn("Logo drawing failed, using fallback", e);
      // Fallback stylized logo
      doc.setFillColor(63, 81, 181);
      doc.roundedRect(x, y, size, size, 2, 2, 'F');
      doc.setTextColor(255);
      doc.setFontSize(size * 0.4);
      doc.setFont("helvetica", "bold");
      doc.text("SHOP", x + size/2, y + size/2 + 1, { align: 'center', baseline: 'middle' });
    }
  };

  const generateStudentCard = async (student: Student, config: any) => {
    setGenerating(student.id + '_card');
    try {
      console.log("Generating card for:", student.nom);
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 53.98]
      });

      // --- FRONT SIDE ---
      doc.setFillColor(15, 23, 42); 
      doc.rect(0, 0, 85.6, 53.98, 'F');
      
      doc.setFillColor(30, 41, 59);
      doc.triangle(40, 0, 85.6, 0, 85.6, 53.98, 'F');
      
      doc.setFillColor(99, 102, 241); 
      doc.rect(0, 0, 85.6, 1.5, 'F');

      await drawLogo(doc, 5, 5, 12);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("SHOP UNIVERSITIES", 19, 10);
      
      doc.setFontSize(4);
      doc.setFont("helvetica", "normal");
      doc.setCharSpace(0.5);
      doc.text("OFFICIAL ACADEMIC IDENTITY CARD", 19, 14);
      doc.setCharSpace(0);

      // Photo Section
      doc.setDrawColor(99, 102, 241);
      doc.setLineWidth(0.3);
      const photoX = 5;
      const photoY = 20;
      doc.roundedRect(photoX, photoY, 24, 28, 1, 1, 'D');

      if (student.photo) {
        try {
          doc.addImage(student.photo, 'JPEG', photoX + 0.5, photoY + 0.5, 23, 27);
        } catch (e) {
          doc.setFontSize(4);
          doc.text("IMG ERR", photoX + 12, photoY + 14, { align: 'center' });
        }
      } else {
        doc.setFillColor(51, 65, 85);
        doc.roundedRect(photoX + 0.5, photoY + 0.5, 23, 27, 0.5, 0.5, 'F');
        doc.setFontSize(5);
        doc.setTextColor(200);
        doc.text("PAS DE PHOTO", photoX + 12, photoY + 14, { align: 'center' });
      }

      // Details Section
      const detailsX = 34;
      doc.setFontSize(5);
      doc.setTextColor(148, 163, 184);
      doc.setFont("helvetica", "bold");
      doc.text("FULL NAME", detailsX, 22);
      doc.text("STUDENT ID", detailsX, 33);
      doc.text("PROGRAM / CLASS", detailsX, 40);
      doc.text("ACADEMIC HOUSE", detailsX, 47);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(`${student.nom.toUpperCase()} ${student.prenom}`, detailsX, 26);
      
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text(student.matricule || student.id.substring(0, 10), detailsX, 36);
      doc.text(config.className?.toUpperCase() || student.className?.toUpperCase() || "N/A", detailsX, 43);
      doc.text(student.houseName?.toUpperCase() || "N/A", detailsX, 50);

      // QR Code
      const qrData = `STUDENT_VERIF:${student.id}`;
      const qrDataUrl = await QRCode.toDataURL(qrData, { 
        margin: 1,
        color: { dark: '#1e293b', light: '#ffffff' }
      });
      
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(68, 35, 14, 14, 1, 1, 'F');
      doc.addImage(qrDataUrl, 'PNG', 69, 36, 12, 12);
      
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(3.5);
      doc.text("VALID UNTIL", 75, 51, { align: 'center' });
      doc.setFontSize(4.5);
      doc.setTextColor(255, 255, 255);
      doc.text(config.academicYear || "2026/2027", 75, 54, { align: 'center' });

      doc.save(`Carte_${student.prenom}_${student.nom}.pdf`);
      console.log("Card saved successfully");
    } catch (err) {
      console.error("Error generating student card:", err);
    } finally {
      setGenerating(null);
      setEditDoc(null);
    }
  };

  const generateCertificate = async (student: Student, config: any) => {
    setGenerating(student.id + '_cert');
    try {
      console.log("Generating certificate for:", student.nom);
      const doc = new jsPDF();
      
      await drawLogo(doc, 20, 15, 22);
      
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.text("SHOP UNIVERSITIES", 48, 26);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("CENTRE D'EXCELLENCE ACADÉMIQUE PROFESSIONNEL", 48, 32);
      doc.text("Libreville, Gabon | Contact: +241 01 02 03 04", 48, 37);

      doc.setDrawColor(226, 232, 240);
      doc.line(20, 45, 190, 45);

      doc.setFontSize(26);
      doc.setFont("times", "bold");
      doc.text("CERTIFICAT DE SCOLARITÉ", 105, 65, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.setLineHeightFactor(1.4);
      
      const bodyText = `Le Chef d'établissement soussigné de Shop Universities, certifie par la présente que l'étudiant(e) identifié(e) ci-dessous est régulièrement inscrit(e) au sein de notre institution et suit assidument son cursus pour l'année académique en cours.`;
      
      const splitText = doc.splitTextToSize(bodyText, 160);
      doc.text(splitText, 25, 80);

      // Student Frame
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(25, 105, 160, 70, 3, 3, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(10);
      doc.text("DÉTAILS DE L'ÉTUDIANT(E)", 35, 115);
      
      doc.setFontSize(11);
      const rowY = 125;
      const spacing = 9;
      
      doc.text(`NOM ET PRÉNOM :`, 35, rowY);
      doc.text(`MATRICULE :`, 35, rowY + spacing);
      doc.text(`NÉ(E) LE :`, 35, rowY + spacing * 2);
      doc.text(`SEXE :`, 120, rowY + spacing * 2);
      doc.text(`CLASSE :`, 35, rowY + spacing * 3);
      doc.text(`PROF. PRINCIPAL :`, 35, rowY + spacing * 4);
      
      doc.setFont("helvetica", "normal");
      doc.text(`${String(student.nom || '').toUpperCase()} ${String(student.prenom || '')}`, 80, rowY);
      doc.text(String(student.matricule || student.id.substring(0, 12)).toUpperCase(), 80, rowY + spacing);
      doc.text(`${String(student.dateNaissance || 'N/A')} à ${String(student.lieuNaissance || 'N/A')}`, 80, rowY + spacing * 2);
      doc.text(student.gender === 'male' ? 'Masculin' : student.gender === 'female' ? 'Féminin' : 'N/A', 135, rowY + spacing * 2);
      doc.text(String(config.className || student.className || 'NON DÉFINIE').toUpperCase(), 80, rowY + spacing * 3);
      doc.text(String(config.mainTeacher || student.mainTeacher || 'NON ASSIGNÉ').toUpperCase(), 80, rowY + spacing * 4);

      doc.setFontSize(12);
      doc.text(`Année Académique : ${config.academicYear || "2026-2027"}`, 25, 190);
      
      const closingText = `En foi de quoi, ce certificat lui est délivré pour servir et valoir ce que de droit.`;
      doc.text(closingText, 25, 200);
      
      doc.setFont("helvetica", "italic");
      doc.text(`Fait à Libreville, le ${new Date().toLocaleDateString('fr-FR')}`, 25, 215);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(config.principalName || "LE DIRECTEUR GÉNÉRAL", 140, 235);
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("(Cachet et Signature de l'Établissement)", 140, 270);

      doc.save(`Certificat_${student.prenom}_${student.nom}.pdf`);
      console.log("Certificate saved successfully");
    } catch (e) {
      console.error("Error generating certificate:", e);
    } finally {
      setGenerating(null);
      setEditDoc(null);
    }
  };

  const generateReportCard = async (student: Student, config: any) => {
    setGenerating(student.id + '_report');
    
    try {
      console.log("Generating report for:", student.nom);
      const q = query(collection(db, 'grades'), where('studentId', '==', student.id));
      const gradeSnapshot = await getDocs(q);
      const studentGrades = gradeSnapshot.docs.map(doc => doc.data());

      if (studentGrades.length === 0) {
        alert("Aucune donnée de notation disponible pour cet élève.");
        setGenerating(null);
        return;
      }

      const subjectAverages: { [key: string]: { weightedSum: number, totalCoef: number, count: number } } = {};
      studentGrades.forEach((g: any) => {
        const subject = g.subject || 'Inconnu';
        if (!subjectAverages[subject]) {
          subjectAverages[subject] = { weightedSum: 0, totalCoef: 0, count: 0 };
        }
        
        const score = parseFloat(g.score);
        const maxScore = parseFloat(g.maxScore) || 20;
        const coef = parseFloat(g.coefficient) || 1;
        
        if (!isNaN(score)) {
          const normalizedScore = (score / maxScore) * 20;
          subjectAverages[subject].weightedSum += normalizedScore * coef;
          subjectAverages[subject].totalCoef += coef;
          subjectAverages[subject].count++;
        }
      });

      const tableData = Object.entries(subjectAverages)
        .filter(([_, stats]) => stats.totalCoef > 0)
        .map(([subject, stats]) => {
          const average = stats.weightedSum / stats.totalCoef;
          const percentage = (average / 20) * 100;
        
        let comment = "";
        if (average >= 16) {
          comment = "Excellent travail sur l'ensemble du trimestre. L'élève fait preuve d'une compréhension approfondie des concepts et d'une rigueur constante dans ses productions.\n\nFélicitations pour cet investissement exemplaire qui tire la classe vers le haut.";
        } else if (average >= 14) {
          comment = "Très bon trimestre. Les résultats sont solides et témoignent d'un travail sérieux et d'une bonne maîtrise des compétences.\n\nContinuez sur cette lancée pour atteindre l'excellence au prochain trimestre.";
        } else if (average >= 12) {
          comment = "Bon travail. Les acquis sont là et les résultats sont satisfaisants. On sent une réelle volonté de bien faire.\n\nIl faudra toutefois veiller à approfondir certains points pour stabiliser ces résultats.";
        } else if (average >= 10) {
          comment = "Résultats corrects mais parfois irréguliers. L'élève atteint les objectifs minimaux mais possède encore une marge de progression importante.\n\nUn travail plus régulier et approfondi à la maison permettrait de gagner en assurance.";
        } else {
          comment = "Ensemble insuffisant ce trimestre. Les lacunes accumulées empêchent pour l'instant une bonne maîtrise du programme.\n\nUn redoublement d'efforts et un suivi plus soutenu sont nécessaires pour redresser la situation rapidement.";
        }

        return [
          subject, 
          stats.totalCoef.toString(), 
          average.toFixed(2), 
          percentage.toFixed(0) + "%", 
          comment
        ];
      });

      const doc = new jsPDF();
      
      // Header Section
      doc.setFillColor(15, 23, 42); 
      doc.rect(0, 0, 210, 50, 'F');
      
      await drawLogo(doc, 15, 10, 25);
      
      doc.setTextColor(255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("BULLETIN DE NOTES", 105, 25, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text("SHOP UNIVERSITIES - GESTION DES ÉVALUATIONS", 105, 33, { align: 'center' });
      doc.text(`${config.academicYear || "ANNÉE 2026-2027"} | ${config.period?.toUpperCase() || "TRIMESTRE 1"}`, 105, 40, { align: 'center' });

      // Student Summary Info
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, 55, 180, 32, 2, 2, 'F');
      
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      
      // Left Column
      doc.text(`ÉTUDIANT :`, 20, 63);
      doc.text(`ID / MATRICULE :`, 20, 70);
      doc.text(`NÉ(E) LE :`, 20, 77);
      doc.text(`À :`, 20, 84);
      
      // Right Column
      doc.text(`CLASSE :`, 110, 63);
      doc.text(`PROF. PRINCIPAL :`, 110, 70);
      doc.text(`SEXE :`, 110, 77);
      
      doc.setFont("helvetica", "normal");
      // Left Column Values
      doc.text(`${String(student.nom || '').toUpperCase()} ${String(student.prenom || '')}`, 50, 63);
      doc.text(String(student.matricule || student.id.substring(0, 10)).toUpperCase(), 50, 70);
      doc.text(String(student.dateNaissance || 'N/A'), 50, 77);
      doc.text(String(student.lieuNaissance || 'N/A').toUpperCase(), 50, 84);
      
      // Right Column Values
      doc.text(String(config.className || student.className || 'NON DÉFINIE').toUpperCase(), 145, 63);
      doc.text(String(config.mainTeacher || student.mainTeacher || 'NON ASSIGNÉ').toUpperCase(), 145, 70);
      doc.text(student.gender === 'male' ? 'MASCULIN' : student.gender === 'female' ? 'FÉMININ' : 'N/A', 145, 77);

      autoTable(doc, {
        startY: 95,
        head: [['DISCIPLINE', 'COEFF', 'MOY /20', '%', 'APPRÉCIATIONS DÉTAILLÉES']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, halign: 'center', fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 35 },
          1: { halign: 'center', cellWidth: 15 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 15 },
          4: { fontStyle: 'italic', cellWidth: 'auto' }
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 15;
      
      // General Average Calculation
      const validSubjects = Object.values(subjectAverages).filter(s => s.totalCoef > 0);
      const sumWeightedAvgs = validSubjects.reduce((acc, s) => acc + (s.weightedSum / s.totalCoef), 0);
      const generalAvg = validSubjects.length > 0 ? sumWeightedAvgs / validSubjects.length : 0;

      doc.setFillColor(30, 41, 59);
      doc.rect(20, finalY, 170, 15, 'F');
      doc.setTextColor(255);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`RÉSULTAT GLOBAL : ${generalAvg.toFixed(2)} / 20`, 105, finalY + 10, { align: 'center' });

      // Bottom Signatures
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.text("Visa Parent/Tuteur", 30, finalY + 40);
      doc.text("Visa de l'Établissement", 140, finalY + 40);
      
      doc.setDrawColor(200);
      doc.rect(25, finalY + 45, 50, 20, 'D');
      doc.rect(135, finalY + 45, 50, 20, 'D');

      doc.save(`Bulletin_${String(student.prenom || 'Eleve').replace(/\s+/g, '_')}_${String(student.nom || '').replace(/\s+/g, '_')}.pdf`);
      console.log("Report saved successfully");
    } catch (err) {
      console.error("Error generating report card:", err);
      alert("Une erreur est survenue lors de la génération du bulletin. Veuillez vérifier les données de l'élève.");
    } finally {
      setGenerating(null);
      setEditDoc(null);
    }
  };

  const filteredStudents = students.filter(s => 
    `${s.prenom} ${s.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.matricule?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <FileBadge size={24} />
            </div>
            {t('document_generator')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Générez des documents officiels (PDF) certifiés par l'établissement.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher un élève par nom ou matricule..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-700/50 text-xs font-black text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">Élève</th>
                <th className="px-6 py-4">Né(e) le</th>
                <th className="px-6 py-4">Classe</th>
                <th className="px-6 py-4">Prof. Principal</th>
                <th className="px-6 py-4 text-center">Générer avec Options</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {student.photo ? (
                        <img src={student.photo} alt="" className="w-10 h-10 rounded-xl object-cover shadow-sm bg-gray-100" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold uppercase">
                          {student.prenom[0]}{student.nom[0]}
                        </div>
                      )}
                      <p className="text-sm font-bold text-gray-900 dark:text-white uppercase italic">{student.prenom} {student.nom}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-mono italic">
                    {student.dateNaissance || '---'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 uppercase font-bold">{student.className || '---'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-500 italic">{student.mainTeacher || '---'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                       <button 
                        onClick={() => setEditDoc({ type: 'card', student, config: { academicYear: '2026-2027', className: student.className || '', mainTeacher: student.mainTeacher || '' } })}
                        className="px-3 py-1.5 bg-purple-100 text-purple-700 text-[10px] font-black rounded-lg hover:scale-105 transition-all"
                      >
                        CARTE E-QR
                      </button>
                      <button 
                         onClick={() => setEditDoc({ type: 'cert', student, config: { academicYear: '2026-2027', principalName: 'M. LE DIRECTEUR', className: student.className || '', mainTeacher: student.mainTeacher || '' } })}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-lg hover:scale-105 transition-all"
                      >
                        CERTIFICAT
                      </button>
                      <button 
                        onClick={() => setEditDoc({ type: 'report', student, config: { academicYear: '2026-2027', period: 'Trimestre 1', className: student.className || '', mainTeacher: student.mainTeacher || '' } })}
                        className="px-3 py-1.5 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-lg hover:scale-105 transition-all"
                      >
                        BULLETIN
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CUSTOMIZATION MODAL */}
      <AnimatePresence>
        {editDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-[2.5rem] w-full max-w-md p-10 border border-white/20 shadow-2xl"
            >
              <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-6">Personnaliser le document</h2>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Année Scolaire</label>
                  <input 
                    type="text" 
                    value={editDoc.config.academicYear} 
                    onChange={e => setEditDoc({...editDoc, config: {...editDoc.config, academicYear: e.target.value}})}
                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-none outline-none font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Classe</label>
                    <select 
                      value={editDoc.config.className} 
                      onChange={e => setEditDoc({...editDoc, config: {...editDoc.config, className: e.target.value}})}
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-none outline-none font-bold text-sm appearance-none"
                    >
                      <option value="">Sélectionner une classe</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.name}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Enseignant Principal</label>
                    <select 
                      value={editDoc.config.mainTeacher} 
                      onChange={e => setEditDoc({...editDoc, config: {...editDoc.config, mainTeacher: e.target.value}})}
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-none outline-none font-bold text-sm appearance-none"
                    >
                      <option value="">Sélectionner un enseignant</option>
                      {teachers.map(teacher => (
                        <option key={teacher.id} value={teacher.name}>{teacher.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {editDoc.type === 'cert' && (
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Nom du Directeur/Signataire</label>
                    <input 
                      type="text" 
                      value={editDoc.config.principalName} 
                      onChange={e => setEditDoc({...editDoc, config: {...editDoc.config, principalName: e.target.value}})}
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-none outline-none font-bold"
                    />
                  </div>
                )}

                {editDoc.type === 'report' && (
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Période (Trimestre/Semestre)</label>
                    <input 
                      type="text" 
                      value={editDoc.config.period} 
                      onChange={e => setEditDoc({...editDoc, config: {...editDoc.config, period: e.target.value}})}
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-none outline-none font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setEditDoc(null)}
                  className="flex-1 py-4 text-gray-500 font-bold bg-gray-100 rounded-2xl"
                >
                  Annuler
                </button>
                <button 
                  onClick={() => {
                    if (editDoc.type === 'card') generateStudentCard(editDoc.student, editDoc.config);
                    if (editDoc.type === 'cert') generateCertificate(editDoc.student, editDoc.config);
                    if (editDoc.type === 'report') generateReportCard(editDoc.student, editDoc.config);
                  }}
                  disabled={generating !== null}
                  className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:scale-105 transition-all"
                >
                  {generating ? '...' : 'Générer PDF'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
