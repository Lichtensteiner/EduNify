import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { UserCircle, GraduationCap, Hash, Mail, Castle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function StudentCard() {
  const { currentUser } = useAuth();
  const [house, setHouse] = useState<any>(null);

  useEffect(() => {
    const fetchHouse = async () => {
      if (currentUser?.house_id) {
        try {
          const houseDoc = await getDoc(doc(db, 'houses', currentUser.house_id));
          if (houseDoc.exists()) {
            setHouse({ id: houseDoc.id, ...houseDoc.data() });
          }
        } catch (error) {
          console.error("Error fetching house:", error);
        }
      }
    };
    fetchHouse();
  }, [currentUser]);

  if (!currentUser) return null;

  const qrData = JSON.stringify({
    id: currentUser.id,
    nom: currentUser.nom,
    prenom: currentUser.prenom,
    classe: currentUser.classe,
    matricule: currentUser.matricule
  });

  return (
    <div className="max-w-md mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Carte Utilisateur</h1>
      </div>

      <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-100 relative">
        {/* Header Background */}
        <div className="h-32 bg-gradient-to-br from-indigo-600 to-purple-700 relative">
          <div className="absolute inset-0 bg-white/10 pattern-grid-lg opacity-20"></div>
          <div className="absolute top-4 left-6 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg">
            <img src="/logo.png" alt="Edu-Nify" className="h-6 object-contain" />
          </div>
          <div className="absolute top-4 right-6">
            <span className="bg-white/20 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
              2025-2026
            </span>
          </div>
        </div>

        {/* Profile Picture */}
        <div className="flex justify-center -mt-16 relative z-10">
          <div className="w-32 h-32 bg-white rounded-full p-2 shadow-lg">
            {currentUser.photo ? (
              <img src={currentUser.photo} alt="Profile" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-4xl uppercase">
                {currentUser.prenom?.[0]}{currentUser.nom?.[0]}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="p-8 pt-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">{currentUser.prenom} {currentUser.nom}</h2>
          <p className="text-indigo-600 font-medium mb-6 capitalize">{currentUser.role}</p>

          <div className="space-y-4 mb-8 text-left bg-gray-50 p-4 rounded-2xl">
            {house && (
              <div className="flex items-center gap-3 text-gray-700">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: `${house.color}20`, color: house.color }}>
                  {house.logo.startsWith('http') ? (
                    <img src={house.logo} alt={house.nom_maison} className="w-5 h-5 object-cover rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-lg">{house.logo}</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Maison</p>
                  <p className="font-bold" style={{ color: house.color }}>{house.nom_maison}</p>
                </div>
              </div>
            )}
            {currentUser.classe && (
              <div className="flex items-center gap-3 text-gray-700">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-indigo-600">
                  <GraduationCap size={16} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Classe</p>
                  <p className="font-bold">{currentUser.classe}</p>
                </div>
              </div>
            )}
            {currentUser.matricule && (
              <div className="flex items-center gap-3 text-gray-700">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-indigo-600">
                  <Hash size={16} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Matricule</p>
                  <p className="font-bold font-mono">{currentUser.matricule}</p>
                </div>
              </div>
            )}
            {currentUser.email && (
              <div className="flex items-center gap-3 text-gray-700">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-indigo-600">
                  <Mail size={16} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Email</p>
                  <p className="font-bold text-sm">{currentUser.email}</p>
                </div>
              </div>
            )}
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center justify-center p-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
            <QRCodeSVG value={qrData} size={150} level="H" includeMargin={true} />
            <p className="text-xs text-gray-400 mt-3 font-medium">Scanner pour vérifier l'identité</p>
          </div>
        </div>
      </div>
    </div>
  );
}
