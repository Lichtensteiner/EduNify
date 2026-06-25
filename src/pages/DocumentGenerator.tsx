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
import { useNotification } from '../contexts/NotificationContext';
import { useEstablishment } from '../contexts/EstablishmentContext';
import { generateAIContent } from '../services/aiService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { Palette, Sparkles, AlertCircle, RefreshCw, Layers } from 'lucide-react';

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
  const { notifyError } = useNotification();

  // Establishment Context Integration
  const { currentEstablishment, establishments } = useEstablishment();
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<string>(currentEstablishment?.id || '');

  const activeEst = establishments.find(e => e.id === selectedEstablishmentId) || currentEstablishment;

  // Helpers for custom branding & graphic design charter
  const getInitials = (name: string) => {
    if (!name) return 'EDU';
    const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 1) return parts[0].substring(0, 3).toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] || '') + (parts[2]?.[0] || '')).toUpperCase();
  };

  const hexToRgb = (hex: string): [number, number, number] => {
    if (!hex) return [79, 70, 229]; // Indigo default
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const num = parseInt(hex, 16);
    if (isNaN(num)) return [79, 70, 229];
    return [
      (num >> 16) & 255,
      (num >> 8) & 255,
      num & 255
    ];
  };

  // AI-Powered Real-Time Graphic Charter designed on demand
  const [aiGraphicCharter, setAiGraphicCharter] = useState<any>({
    themeName: "Identité Classique Académique",
    headerLayout: "academic_crest",
    borderColor: activeEst?.primaryColor || "#4f46e5",
    borderWidth: 1.2,
    showWatermark: true,
    watermarkText: (activeEst?.nom || "CAMPUS").toUpperCase(),
    cardStyle: "premium_gradient",
    titleFont: "helvetica",
    designerAdvice: "Une charte institutionnelle classique avec des lignes sobres de couleur or et indigo."
  });

  const [isGeneratingCharter, setIsGeneratingCharter] = useState(false);

  const handleGenerateAICharter = async () => {
    setIsGeneratingCharter(true);
    try {
      const prompt = `Tu es un designer graphique professionnel et expert en chartes graphiques pour les écoles d'excellence. 
L'établissement s'appelle : "${activeEst?.nom || 'Mon École'}", sa devise est : "${activeEst?.devise || 'Savoir, Rigueur, Excellence'}", ses couleurs de marque sont le Primaire: "${activeEst?.primaryColor || '#4f46e5'}" et le Secondaire: "${activeEst?.secondaryColor || '#ea580c'}".

Suggère une charte graphique élégante et moderne pour ses documents officiels (carte d'étudiant, certificat de scolarité, bulletin scolaire).
Génère une réponse sous forme d'un objet JSON pur et valide (sans aucun blabla, sans balise markdown de code, juste l'objet brut) contenant strictement ces clés :
{
  "themeName": "Un nom poétique en français pour ce thème de design",
  "headerLayout": "Un des styles suivants : 'classic_centered', 'modern_minimalist', 'academic_crest', 'luxury_ribbon'",
  "borderColor": "Code couleur hexadécimal complémentaire à associer aux bordures (ex: '#cccccc')",
  "borderWidth": "Une épaisseur de bordure esthétique en mm (ex: 1.5)",
  "showWatermark": true ou false,
  "watermarkText": "Un court texte en capitales à afficher en fond (ex: '${(activeEst?.nom || 'CAMPUS').toUpperCase()}')",
  "cardStyle": "Un des styles suivants : 'premium_gradient', 'minimalist_dark', 'school_house_spirit'",
  "titleFont": "Un style de police : 'helvetica' ou 'times'",
  "designerAdvice": "Un court conseil d'expert en graphisme (en français) sur pourquoi cette charte correspond parfaitement à cet établissement"
}`;

      const res = await generateAIContent({
        contents: prompt
      });

      if (res && res.text) {
        let cleaned = res.text.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/```json|```/g, '').trim();
        }
        const parsed = JSON.parse(cleaned);
        setAiGraphicCharter(parsed);
      }
    } catch (e) {
      console.error("AI Charter Generation failed, using customized defaults", e);
      setAiGraphicCharter({
        themeName: "Charte de Prestige",
        headerLayout: "academic_crest",
        borderColor: activeEst?.primaryColor || "#4f46e5",
        borderWidth: 1.2,
        showWatermark: true,
        watermarkText: (activeEst?.nom || "CAMPUS").toUpperCase(),
        cardStyle: "premium_gradient",
        titleFont: "times",
        designerAdvice: "Adaptation dynamique basée sur les caractéristiques de l'établissement."
      });
    } finally {
      setIsGeneratingCharter(false);
    }
  };

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('Tous');
  const [generating, setGenerating] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [teachers, setTeachers] = useState<{id: string, name: string}[]>([]);
  
  // Global generation params
  const [globalConfig, setGlobalConfig] = useState({
    academicYear: '2026-2027',
    period: 'Trimestre 1',
    principalName: 'M. LE DIRECTEUR'
  });
  
  // Customization state
  const [editDoc, setEditDoc] = useState<{
    type: 'card' | 'cert' | 'report';
    student: Student;
    config: any;
  } | null>(null);

  useEffect(() => {
    if (activeEst) {
      setAiGraphicCharter({
        themeName: "Identité Classique Académique",
        headerLayout: "academic_crest",
        borderColor: activeEst.primaryColor || "#4f46e5",
        borderWidth: 1.2,
        showWatermark: true,
        watermarkText: (activeEst.nom || "CAMPUS").toUpperCase(),
        cardStyle: "premium_gradient",
        titleFont: "helvetica",
        designerAdvice: "Une charte institutionnelle classique avec des lignes sobres."
      });
    }
  }, [selectedEstablishmentId, currentEstablishment]);

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
        const q = query(collection(db, 'users'), where('role', 'in', ['élève', 'eleve']));
        const snapshot = await getDocs(q);
        
        const studentsList = snapshot.docs.map(doc => {
          const data = doc.data();
          // Resolution of class info from ID or name
          let classInfo = data.classId ? classesMap.get(data.classId) : null;
          
          if (!classInfo && (data.classe || data.className)) {
            // Try to match the 'classe' string with the names in our classesMap
            const targetName = data.classe || data.className;
            const foundClass = Array.from(classesMap.values()).find((c: any) => c.name === targetName);
            if (foundClass) classInfo = foundClass;
          }

          return { 
            id: doc.id, 
            ...data,
            className: classInfo ? classInfo.name : (data.classe || data.className || 'Non assignée'),
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
      const activeLogo = activeEst?.logo || '/logo.png';
      let imgData = '';
      if (activeLogo.startsWith('data:')) {
        imgData = activeLogo;
      } else {
        imgData = await getImageDataUrl(activeLogo);
      }
      doc.addImage(imgData, 'PNG', x, y, size, size);
    } catch (e) {
      console.warn("Logo drawing failed, using fallback", e);
      // Fallback stylized logo based on initials
      const initials = getInitials(activeEst?.nom || 'EDU');
      const pColor = hexToRgb(activeEst?.primaryColor || '#4f46e5');
      doc.setFillColor(pColor[0], pColor[1], pColor[2]);
      doc.roundedRect(x, y, size, size, 1.5, 1.5, 'F');
      doc.setTextColor(255);
      doc.setFontSize(size * 0.38);
      doc.setFont("helvetica", "bold");
      doc.text(initials, x + size/2, y + size/2 + 0.5, { align: 'center', baseline: 'middle' });
    }
  };

  const drawPageBorder = (doc: jsPDF, width: number, height: number) => {
    const margin = 8;
    const bColor = hexToRgb(aiGraphicCharter.borderColor || activeEst?.primaryColor || '#4f46e5');
    doc.setDrawColor(bColor[0], bColor[1], bColor[2]);
    doc.setLineWidth(aiGraphicCharter.borderWidth || 1);
    doc.rect(margin, margin, width - margin * 2, height - margin * 2);
    
    // Micro thin double line inside for expert styling
    doc.setLineWidth(0.25);
    doc.rect(margin + 1.2, margin + 1.2, width - (margin + 1.2) * 2, height - (margin + 1.2) * 2);
  };

  const drawWatermark = (doc: jsPDF, width: number, height: number) => {
    if (!aiGraphicCharter.showWatermark) return;
    const anyDoc = doc as any;
    anyDoc.saveState();
    anyDoc.setTextColor(245, 245, 245); // Soft, ultra faint watermark
    anyDoc.setFontSize(32);
    anyDoc.setFont("helvetica", "bold");
    anyDoc.rotate(-40, width / 2, height / 2);
    anyDoc.text(aiGraphicCharter.watermarkText || "CAMPUS EXCELLENCE", width / 2, height / 2, { align: 'center' });
    anyDoc.restoreState();
  };

  const drawHeaderDecoration = (doc: jsPDF, width: number) => {
    const pColor = hexToRgb(activeEst?.primaryColor || '#4f46e5');
    const sColor = hexToRgb(activeEst?.secondaryColor || '#ea580c');
    
    if (aiGraphicCharter.headerLayout === 'academic_crest') {
      doc.setFillColor(pColor[0], pColor[1], pColor[2]);
      doc.rect(8, 8, width - 16, 2.5, 'F');
      doc.setFillColor(sColor[0], sColor[1], sColor[2]);
      doc.rect(8, 10.5, width - 16, 1, 'F');
    } else if (aiGraphicCharter.headerLayout === 'luxury_ribbon') {
      doc.setFillColor(pColor[0], pColor[1], pColor[2]);
      doc.rect(8, 8, 4, 30, 'F');
      doc.setFillColor(sColor[0], sColor[1], sColor[2]);
      doc.rect(12, 8, 1, 30, 'F');
    } else if (aiGraphicCharter.headerLayout === 'modern_minimalist') {
      doc.setFillColor(pColor[0], pColor[1], pColor[2]);
      doc.rect(8, 8, 30, 2, 'F');
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
      const primaryColorRGB = hexToRgb(activeEst?.primaryColor || '#4f46e5');
      const secondaryColorRGB = hexToRgb(activeEst?.secondaryColor || '#ea580c');

      // Card Background with dual brand accents
      doc.setFillColor(15, 23, 42); 
      doc.rect(0, 0, 85.6, 53.98, 'F');
      
      doc.setFillColor(secondaryColorRGB[0], secondaryColorRGB[1], secondaryColorRGB[2]);
      doc.triangle(38, 0, 85.6, 0, 85.6, 53.98, 'F');
      
      doc.setFillColor(primaryColorRGB[0], primaryColorRGB[1], primaryColorRGB[2]); 
      doc.rect(0, 0, 85.6, 1.5, 'F');

      await drawLogo(doc, 5, 5, 12);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(activeEst?.nom && activeEst.nom.length > 25 ? 6.5 : 8);
      doc.setFont("helvetica", "bold");
      doc.text((activeEst?.nom || "CENTRE PÉDAGOGIQUE").toUpperCase(), 19, 10);
      
      doc.setFontSize(4);
      doc.setFont("helvetica", "normal");
      doc.setCharSpace(0.3);
      doc.text((activeEst?.devise || "Savoir - Rigueur - Excellence").toUpperCase(), 19, 14);
      doc.setCharSpace(0);

      // Photo Section styled with brand border
      doc.setDrawColor(primaryColorRGB[0], primaryColorRGB[1], primaryColorRGB[2]);
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
      
      const primaryColorRGB = hexToRgb(activeEst?.primaryColor || '#4f46e5');
      const secondaryColorRGB = hexToRgb(activeEst?.secondaryColor || '#ea580c');

      // AI-Adapted structural decorations
      drawPageBorder(doc, 210, 297);
      drawWatermark(doc, 210, 297);
      drawHeaderDecoration(doc, 210);

      await drawLogo(doc, 20, 15, 22);
      
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.text((activeEst?.nom || "CENTRE PÉDAGOGIQUE SHOPUNIVERSITIES").toUpperCase(), 48, 22);
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(activeEst?.adresse || "Libreville, Gabon", 48, 28);
      doc.text(`E-mail: ${activeEst?.email || "contact@school.com"} | Site: ${activeEst?.siteWeb || "www.school.com"}`, 48, 33);
      doc.text(`Tél: ${activeEst?.telephone || "+241 011 44 9292"}`, 48, 38);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(20, 43, 190, 43);

      doc.setFontSize(24);
      doc.setFont(aiGraphicCharter.titleFont || "times", "bold");
      doc.setTextColor(primaryColorRGB[0], primaryColorRGB[1], primaryColorRGB[2]);
      doc.text("CERTIFICAT DE SCOLARITÉ", 105, 62, { align: 'center' });
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.setLineHeightFactor(1.45);
      
      const bodyText = `Le Chef d'établissement soussigné de "${activeEst?.nom || 'l\'établissement'} ${activeEst?.devise ? '- ' + activeEst.devise : ''}", certifie par la présente que l'étudiant(e) identifié(e) ci-dessous est régulièrement inscrit(e) au sein de notre institution et suit assidument son cursus pour l'année académique en cours.`;
      
      const splitText = doc.splitTextToSize(bodyText, 160);
      doc.text(splitText, 25, 76);

      // Student Frame styled with brand colors
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(25, 102, 160, 72, 3, 3, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryColorRGB[0], primaryColorRGB[1], primaryColorRGB[2]);
      doc.setFontSize(10);
      doc.text("DÉTAILS DE L'ÉTUDIANT(E)", 35, 112);
      
      doc.setFontSize(10.5);
      const rowY = 122;
      const spacing = 9;
      
      doc.setTextColor(100, 116, 139);
      doc.text(`NOM ET PRÉNOM :`, 35, rowY);
      doc.text(`MATRICULE :`, 35, rowY + spacing);
      doc.text(`NÉ(E) LE :`, 35, rowY + spacing * 2);
      doc.text(`SEXE :`, 120, rowY + spacing * 2);
      doc.text(`CLASSE :`, 35, rowY + spacing * 3);
      doc.text(`PROF. PRINCIPAL :`, 35, rowY + spacing * 4);
      
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.text(`${String(student.nom || '').toUpperCase()} ${String(student.prenom || '')}`, 80, rowY);
      doc.setFont("helvetica", "normal");
      doc.text(String(student.matricule || student.id.substring(0, 12)).toUpperCase(), 80, rowY + spacing);
      doc.text(`${String(student.dateNaissance || 'N/A')} à ${String(student.lieuNaissance || 'N/A')}`, 80, rowY + spacing * 2);
      doc.text(student.gender === 'male' ? 'Masculin' : student.gender === 'female' ? 'Féminin' : 'N/A', 135, rowY + spacing * 2);
      doc.text(String(config.className || student.className || 'NON DÉFINIE').toUpperCase(), 80, rowY + spacing * 3);
      doc.text(String(config.mainTeacher || student.mainTeacher || 'NON ASSIGNÉ').toUpperCase(), 80, rowY + spacing * 4);

      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      doc.text(`Année Académique : ${config.academicYear || "2026-2027"}`, 25, 188);
      
      const closingText = `En foi de quoi, ce certificat lui est délivré pour servir et valoir ce que de droit.`;
      doc.text(closingText, 25, 198);
      
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.text(`Fait à ${activeEst?.adresse ? activeEst.adresse.split(',')[0] : "Libreville"}, le ${new Date().toLocaleDateString('fr-FR')}`, 25, 212);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(primaryColorRGB[0], primaryColorRGB[1], primaryColorRGB[2]);
      
      const pName = config.principalName || (activeEst?.responsableCivility ? activeEst.responsableCivility + " " : "") + (activeEst?.responsablePrenom || "") + " " + (activeEst?.responsableNom || "") || "LE DIRECTEUR GÉNÉRAL";
      doc.text(pName.toUpperCase(), 140, 230);
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text("(Cachet et Signature autorisés)", 140, 260);

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
      console.log("Generating report for:", student.nom, student.prenom, "ID:", student.id);
      
      // Try multiple possible ID keys to be more resilient
      const q = query(collection(db, 'grades'), where('studentId', '==', student.id));
      const gradeSnapshot = await getDocs(q);
      let studentGrades = gradeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fallback 1: Try searching by student name if ID search returns nothing
      if (studentGrades.length === 0) {
        console.log("No grades found by studentId, trying fallback search by name...");
        const nameQuery = query(
          collection(db, 'grades'), 
          where('studentName', '==', `${student.prenom} ${student.nom}`)
        );
        const nameSnapshot = await getDocs(nameQuery);
        studentGrades = nameSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      // Fallback 2: Try alternate field name student_id
      if (studentGrades.length === 0) {
        const altQuery = query(collection(db, 'grades'), where('student_id', '==', student.id));
        const altSnapshot = await getDocs(altQuery);
        studentGrades = altSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      console.log("Found grades count:", studentGrades.length);

      if (studentGrades.length === 0) {
        // Final fallback: try search all grades and filter manually (expensive but better than nothing for a single student)
        const allGradesSnap = await getDocs(collection(db, 'grades'));
        studentGrades = allGradesSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(g => 
            g.studentId === student.id || 
            g.student_id === student.id ||
            g.studentName?.toLowerCase() === `${student.prenom} ${student.nom}`.toLowerCase()
          );
      }

      if (studentGrades.length === 0) {
        notifyError(`Aucune donnée de notation disponible pour ${student.prenom} ${student.nom}. Veuillez vérifier que ses notes ont bien été saisies.`);
        setGenerating(null);
        return;
      }

      const subjectAverages: { [key: string]: { weightedSum: number, totalCoef: number, count: number } } = {};
      
      // Group by subject and calculate averages
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

      const tableData = Object.entries(subjectAverages).map(([subject, stats]) => {
        const average = stats.totalCoef > 0 ? stats.weightedSum / stats.totalCoef : 0;
        const percentage = (average / 20) * 100;
        
        let comment = "";
        if (average >= 16) {
          comment = "Excellent travail sur l'ensemble de la période. L'élève fait preuve d'une compréhension approfondie des concepts et d'une rigueur constante.";
        } else if (average >= 14) {
          comment = "Très bon trimestre. Les résultats sont solides et témoignent d'un travail sérieux et d'une bonne maîtrise des compétences.";
        } else if (average >= 12) {
          comment = "Bon travail. Les acquis sont là et les résultats sont satisfaisants. On sent une réelle volonté de bien faire.";
        } else if (average >= 10) {
          comment = "Résultats corrects mais parfois irréguliers. L'élève atteint les objectifs minimaux mais possède encore une marge de progression.";
        } else {
          comment = "Ensemble insuffisant ce trimestre. Les lacunes accumulées empêchent pour l'instant une bonne maîtrise du programme.";
        }

        return [
          subject.toUpperCase(), 
          stats.totalCoef.toFixed(0), 
          average.toFixed(2), 
          percentage.toFixed(0) + "%", 
          comment
        ];
      });

      const doc = new jsPDF();
      
      const primaryColorRGB = hexToRgb(activeEst?.primaryColor || '#4f46e5');
      const secondaryColorRGB = hexToRgb(activeEst?.secondaryColor || '#ea580c');

      // AI-Adapted structural decorations
      drawPageBorder(doc, 210, 297);
      drawWatermark(doc, 210, 297);
      
      // Header Section
      doc.setFillColor(primaryColorRGB[0], primaryColorRGB[1], primaryColorRGB[2]); 
      doc.rect(8, 8, 194, 42, 'F');

      doc.setFillColor(secondaryColorRGB[0], secondaryColorRGB[1], secondaryColorRGB[2]);
      doc.rect(8, 48, 194, 2, 'F');
      
      try {
        await drawLogo(doc, 15, 12, 22);
      } catch (e) {
        console.warn("Skipping logo in PDF due to error");
      }
      
      doc.setTextColor(255);
      doc.setFontSize(16);
      doc.setFont(aiGraphicCharter.titleFont || "times", "bold");
      doc.text("BULLETIN TRIMESTRIEL DE NOTES", 115, 22, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text((activeEst?.nom || "CENTRE PÉDAGOGIQUE").toUpperCase(), 115, 29, { align: 'center' });
      
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(241, 245, 249);
      doc.text((activeEst?.adresse || "Libreville, Gabon").toUpperCase(), 115, 34, { align: 'center' });
      doc.text(`Email: ${activeEst?.email || "contact@school.com"} | Tél: ${activeEst?.telephone || "+241 011 44 9292"}`, 115, 38, { align: 'center' });
      doc.text(`${config.academicYear || "ANNÉE ACADÉMIQUE 2026-2027"} | ${config.period?.toUpperCase() || "TRIMESTRE 1"}`, 115, 43, { align: 'center' });

      // Student Summary Info - WELL STRUCTURED
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, 55, 180, 35, 2, 2, 'FD');
      
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      
      // Headers
      const colL1 = 20;  // Left Header
      const colL2 = 48;  // Left Value
      const colR1 = 110; // Right Header
      const colR2 = 145; // Right Value
      
      let currentY = 63;
      const stepY = 8;

      doc.text(`ÉTUDIANT :`, colL1, currentY);
      doc.text(`CLASSE :`, colR1, currentY);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`${String(student.nom || '').toUpperCase()} ${String(student.prenom || '')}`, colL2, currentY);
      doc.text(String(config.className || student.className || 'NON DÉFINIE').toUpperCase(), colR2, currentY);
      
      currentY += stepY;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(`MATRICULE :`, colL1, currentY);
      doc.text(`PROF. PRINCIPAL :`, colR1, currentY);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(String(student.matricule || student.id.substring(0, 10)).toUpperCase(), colL2, currentY);
      doc.text(String(config.mainTeacher || student.mainTeacher || 'NON ASSIGNÉ').toUpperCase(), colR2, currentY);
      
      currentY += stepY;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(`NÉ(E) LE :`, colL1, currentY);
      doc.text(`SEXE :`, colR1, currentY);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`${String(student.dateNaissance || 'N/A')} à ${String(student.lieuNaissance || 'Non spécifié').toUpperCase()}`, colL2, currentY);
      doc.text(student.gender === 'male' ? 'MASCULIN' : student.gender === 'female' ? 'FÉMININ' : 'N/A', colR2, currentY);

      autoTable(doc, {
        startY: 100,
        head: [['DISCIPLINE', 'COEFF', 'MOY /20', '%', 'APPRÉCIATIONS DÉTAILLÉES']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [primaryColorRGB[0], primaryColorRGB[1], primaryColorRGB[2]], textColor: 255, halign: 'center', fontSize: 9, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 },
          1: { halign: 'center', cellWidth: 15 },
          2: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
          3: { halign: 'center', cellWidth: 15 },
          4: { fontStyle: 'italic', cellWidth: 'auto' }
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 15;
      
      // General Average Calculation
      const validSubjects = Object.values(subjectAverages).filter(s => s.totalCoef > 0);
      const sumWeightedAvgs = validSubjects.reduce((acc, s) => acc + (s.weightedSum / s.totalCoef), 0);
      const generalAvg = validSubjects.length > 0 ? sumWeightedAvgs / validSubjects.length : 0;

      doc.setFillColor(primaryColorRGB[0], primaryColorRGB[1], primaryColorRGB[2]);
      doc.rect(20, finalY, 170, 15, 'F');
      doc.setTextColor(255);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`MOYENNE GÉNÉRALE : ${generalAvg.toFixed(2)} / 20`, 105, finalY + 10, { align: 'center' });

      // Bottom Signatures
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.text("Le Parent / Tuteur", 30, finalY + 40);
      doc.text("Le Directeur de l'Établissement", 130, finalY + 40);
      
      doc.setDrawColor(200);
      doc.rect(25, finalY + 45, 50, 20, 'D');
      doc.rect(135, finalY + 45, 50, 20, 'D');

      doc.save(`Bulletin_${String(student.prenom || 'Eleve').replace(/\s+/g, '_')}_${String(student.nom || '').replace(/\s+/g, '_')}.pdf`);
      console.log("Report saved successfully");
    } catch (err) {
      console.error("Error generating report card:", err);
      notifyError("Une erreur est survenue lors de la génération du bulletin. Veuillez vérifier la console pour plus d'infos.");
    } finally {
      setGenerating(null);
      setEditDoc(null);
    }
  };


  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.prenom} ${s.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.matricule?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === 'Tous' || s.className === selectedClass;
    return matchesSearch && matchesClass;
  });

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

      {/* SELECTION ETABLISSEMENT & CONFIGURATION EXPERTE DE CHARTE GRAPHIQUE AVEC IA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PANEL 1: SELECTION ETABLISSEMENT DIRECTE */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Layers className="text-blue-600 dark:text-blue-400" size={20} />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Établissement Actif</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Sélectionnez l'établissement pour charger son logo, ses couleurs de marque et ses informations de signature officielle.
          </p>
          <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
            {establishments.map((est) => (
              <button
                key={est.id}
                onClick={() => setSelectedEstablishmentId(est.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                  selectedEstablishmentId === est.id
                    ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20'
                    : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white"
                  style={{ backgroundColor: est.primaryColor || '#4f46e5' }}
                >
                  {getInitials(est.nom)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{est.nom}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{est.adresse || 'Gabon'}</p>
                </div>
                {selectedEstablishmentId === est.id && (
                  <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* PANEL 2: CHARTE GRAPHIQUE COURANTE */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Palette className="text-indigo-600 dark:text-indigo-400" size={20} />
                <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Charte de Design Actuelle</h2>
              </div>
              <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full text-[9px] font-black uppercase">
                {aiGraphicCharter.themeName ? 'IA DESIGN' : 'STANDARD'}
              </span>
            </div>
            
            <div className="space-y-2 mt-3 text-xs text-gray-600 dark:text-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-400">Thème :</span>
                <span className="font-bold text-gray-800 dark:text-gray-100">{aiGraphicCharter.themeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Disposition Entête :</span>
                <span className="font-mono bg-gray-50 dark:bg-gray-900 px-1.5 rounded text-[10px] text-indigo-600">{aiGraphicCharter.headerLayout}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Couleur Bordure :</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full border border-gray-300" style={{ backgroundColor: aiGraphicCharter.borderColor }}></div>
                  <span className="font-mono text-[10px]">{aiGraphicCharter.borderColor}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Filigrane :</span>
                <span className="font-bold text-gray-800 dark:text-gray-100">{aiGraphicCharter.showWatermark ? `OUI (${aiGraphicCharter.watermarkText})` : 'NON'}</span>
              </div>
            </div>
          </div>
          
          <div className="pt-2 border-t border-gray-100 dark:border-gray-750 mt-2 text-[10px] text-gray-400 italic">
            Couleurs de marque : Primaire {activeEst?.primaryColor || '#4f46e5'} | Secondaire {activeEst?.secondaryColor || '#ea580c'}
          </div>
        </div>

        {/* PANEL 3: EXPERT GRAPHISTE IA */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-lg flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="text-amber-400 animate-pulse" size={20} />
              <h2 className="text-sm font-black uppercase tracking-wider">Expert Graphique IA</h2>
            </div>
            <p className="text-xs text-indigo-200 leading-relaxed">
              L'IA analyse le nom, la devise et les couleurs de l'établissement pour concevoir instantanément une charte graphique sur-mesure (Watermarks, polices, bordures, dispositions).
            </p>
            {aiGraphicCharter.designerAdvice && (
              <div className="bg-white/10 p-2.5 rounded-xl border border-white/5 text-[10px] italic text-indigo-100 mt-2">
                "{aiGraphicCharter.designerAdvice}"
              </div>
            )}
          </div>

          <button
            onClick={handleGenerateAICharter}
            disabled={isGeneratingCharter}
            className="w-full mt-4 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 disabled:from-gray-700 disabled:to-gray-800 text-slate-900 font-bold uppercase text-[10px] tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:cursor-not-allowed"
          >
            {isGeneratingCharter ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                Conception en cours...
              </>
            ) : (
              <>
                <Sparkles size={13} className="text-slate-900" />
                Personnaliser avec l'IA en temps réel
              </>
            )}
          </button>
        </div>

      </div>
      
      {/* GLOBAL SETTINGS */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Année Académique</label>
          <input 
            type="text" 
            value={globalConfig.academicYear}
            onChange={(e) => setGlobalConfig({...globalConfig, academicYear: e.target.value})}
            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-none rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Période par défaut</label>
          <input 
            type="text" 
            value={globalConfig.period}
            onChange={(e) => setGlobalConfig({...globalConfig, period: e.target.value})}
            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-none rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Nom du Signataire</label>
          <input 
            type="text" 
            value={globalConfig.principalName}
            onChange={(e) => setGlobalConfig({...globalConfig, principalName: e.target.value})}
            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-none rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher un élève par nom ou matricule..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold appearance-none min-w-[150px]"
            >
              <option value="Tous">Toutes les classes</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.name}>{cls.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl">
             <Users size={18} />
             <span className="text-xs font-black uppercase tracking-widest">{filteredStudents.length} élèves affichés</span>
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
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium">
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
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white uppercase italic">{student.prenom} {student.nom}</p>
                        <p className="text-[10px] text-gray-400 font-mono tracking-tighter">ID: {student.matricule || student.id.substring(0, 10)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[13px] text-gray-600 dark:text-gray-400 font-mono italic">
                    {student.dateNaissance || '---'}
                  </td>
                  <td className="px-6 py-4 text-[13px] text-gray-800 dark:text-gray-200 uppercase font-black tracking-tighter">{student.className || '---'}</td>
                  <td className="px-6 py-4 text-xs text-indigo-600 dark:text-indigo-400 italic font-bold">
                    <span className="bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-md">
                      {student.mainTeacher || '---'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                       <button 
                        onClick={() => setEditDoc({ type: 'card', student, config: { ...globalConfig, className: student.className || '', mainTeacher: student.mainTeacher || '' } })}
                        className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-xl transition-all"
                        title="Carte E-QR"
                      >
                        <IdCard size={18} />
                      </button>
                      <button 
                         onClick={() => setEditDoc({ type: 'cert', student, config: { ...globalConfig, className: student.className || '', mainTeacher: student.mainTeacher || '' } })}
                        className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all"
                        title="Certificat"
                      >
                        <FileText size={18} />
                      </button>
                      <button 
                        onClick={() => setEditDoc({ type: 'report', student, config: { ...globalConfig, className: student.className || '', mainTeacher: student.mainTeacher || '' } })}
                        className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all"
                        title="Bulletin"
                      >
                        <FileBadge size={18} />
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
