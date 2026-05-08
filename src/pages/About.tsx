import React from 'react';
import { Info, Mail, Phone, MapPin, Code, Shield, Users, Calendar, MessageCircle, Award, GraduationCap } from 'lucide-react';

export default function About() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6">
            <Info size={32} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">
            À propos de l'application
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl">
            Une solution complète de gestion scolaire moderne, conçue pour renforcer le lien entre l'école, les enseignants, les élèves et les parents.
          </p>
        </div>
      </div>

      {/* Developer Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Code className="text-indigo-600" size={24} />
            Conception & Développement
          </h2>
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shrink-0">
              LZ
            </div>
            <div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-1">
                M. Mve Zogo Ludovic Martinien
              </h3>
              <p className="text-indigo-600 dark:text-indigo-400 font-bold mb-4">
                Dev Lichtensteiner
              </p>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Jeune ingénieur des logiciels Gabonais passionné par l'innovation technologique et l'éducation. 
                Spécialisé dans la création de solutions numériques robustes et intuitives qui répondent aux défis 
                locaux avec des standards internationaux.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-500/20 flex flex-col justify-between">
          <h2 className="text-xl font-bold mb-6">Contact</h2>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Mail size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-indigo-200 font-bold uppercase tracking-wider">E-mail</p>
                <p className="text-sm font-medium truncate">martinienmvezogo@gmail.com</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Phone size={20} />
              </div>
              <div>
                <p className="text-xs text-indigo-200 font-bold uppercase tracking-wider">Contact</p>
                <p className="text-sm font-medium">+241 062-641-120</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <MapPin size={20} />
              </div>
              <div>
                <p className="text-xs text-indigo-200 font-bold uppercase tracking-wider">Adresse</p>
                <p className="text-sm font-medium">Libreville, Gabon</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white px-4">
          Fonctionnalités Clés
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: "Gestion de Classe",
              desc: "Suivi en temps réel des élèves, gestion du comportement et attribution de points.",
              icon: GraduationCap,
              color: "bg-blue-50 text-blue-600"
            },
            {
              title: "Messagerie Intégrée",
              desc: "Communication directe et sécurisée entre enseignants, parents et administration.",
              icon: MessageCircle,
              color: "bg-green-50 text-green-600"
            },
            {
              title: "Pointage Biométrique",
              desc: "Système innovant de présence via reconnaissance faciale et QR codes.",
              icon: Shield,
              color: "bg-purple-50 text-purple-600"
            },
            {
              title: "Histoire de Classe",
              desc: "Partage de ressources pédagogiques, photos et vidéos des activités scolaires.",
              icon: Award,
              color: "bg-orange-50 text-orange-600"
            },
            {
              title: "Calendrier & Événements",
              desc: "Planification des réunions, examens et activités avec rappels automatiques.",
              icon: Calendar,
              color: "bg-red-50 text-red-600"
            },
            {
              title: "Rapports Statistiques",
              desc: "Analyse détaillée de l'assiduité et des performances pour une meilleure prise de décision.",
              icon: Users,
              color: "bg-indigo-50 text-indigo-600"
            }
          ].map((feature, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 ${feature.color} rounded-2xl flex items-center justify-center mb-4`}>
                <feature.icon size={24} />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Mission Section */}
      <div className="bg-gray-900 rounded-[3rem] p-12 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2 className="text-3xl font-black text-white mb-6">Notre Mission</h2>
          <p className="text-gray-300 text-lg leading-relaxed italic">
            "Digitaliser l'éducation pour offrir aux établissements scolaires des outils à la pointe de la technologie, 
            simplifiant l'administration et enrichissant l'expérience d'apprentissage de chaque élève."
          </p>
          <div className="mt-8 pt-8 border-t border-white/10 flex justify-center gap-8">
            <div className="text-center">
              <p className="text-2xl font-black text-white">100%</p>
              <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">Digital</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-white">Sécurisé</p>
              <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">Protection</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-white">Innovant</p>
              <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">Standard</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="text-center pb-8">
        <p className="text-sm text-gray-500">
          © 2026 Edu-Nify. Tous droits réservés. Développé par Dev Lichtensteiner.
        </p>
      </div>
    </div>
  );
}
