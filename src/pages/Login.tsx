import React, { useState, useEffect } from 'react';
import { useAuth, User } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RefreshCw, ShieldCheck, UserPlus } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Login() {
  const [isRegisteringState, setIsRegisteringState] = useState(false);
  const [error, setError] = useState('');
  const { login, register, loading } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    // Initialize history state
    window.history.replaceState({ isRegistering: false }, '');

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.isRegistering !== undefined) {
        setIsRegisteringState(event.state.isRegistering);
      } else {
        setIsRegisteringState(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const isRegistering = isRegisteringState;
  const setIsRegistering = (value: boolean) => {
    setIsRegisteringState(value);
    if (value) {
      window.history.pushState({ isRegistering: true }, '');
    } else {
      window.history.pushState({ isRegistering: false }, '');
    }
  };

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register state
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [role, setRole] = useState<User['role']>('élève');
  const [classe, setClasse] = useState('');
  const [matricule, setMatricule] = useState('');
  const [houseId, setHouseId] = useState('');
  const [houses, setHouses] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [position, setPosition] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'houses'), (snapshot) => {
      const housesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHouses(housesData);
    }, (err) => {
      console.error("Erreur onSnapshot houses:", err);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'classes'), (snapshot) => {
      const classesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClasses(classesData);
    }, (err) => {
      console.error("Erreur onSnapshot classes:", err);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isRegistering) {
        if (!nom || !prenom || !email || !password || !role) {
          setError(t('fill_required_fields'));
          return;
        }

        // Security reinforcement: Only allow specific email to register as admin
        if (role === 'admin' && email.toLowerCase() !== 'martinienmvezogo@gmail.com') {
          setError(t('only_admin_can_register'));
          return;
        }

        if (role === 'élève' && !classe) {
          setError(t('class_required_for_student'));
          return;
        }

        await register({
          nom,
          prenom,
          email,
          role,
          matricule,
          ...(role === 'élève' && houseId ? { house_id: houseId } : {}),
          ...(role === 'élève' ? { classe } : {}),
          ...(role === 'personnel administratif' ? { position, department: 'Administration' } : {})
        }, password);
      } else {
        if (!email || !password) {
          setError(t('enter_email_password'));
          return;
        }
        await login(email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError(t('email_already_used'));
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError(t('incorrect_email_password'));
      } else if (err.code === 'auth/weak-password') {
        setError(t('password_min_length'));
      } else if (err.code === 'auth/configuration-not-found') {
        setError(t('auth_not_enabled'));
      } else if (err.code === 'auth/network-request-failed') {
        setError(t('network_error'));
      } else {
        setError(err.message || t('error_occurred'));
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img src="/logo.png" alt="Logo" className="h-24 mx-auto object-contain" />
        <p className="mt-6 text-center text-sm text-gray-600 uppercase font-black tracking-widest">
          {t('attendance_management_system')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          {isRegistering && (
            <div className="mb-6 text-center">
              <h3 className="text-xl font-bold text-gray-900">{t('step1_basic_info')}</h3>
              <p className="text-sm text-gray-500 mt-1">{t('biometric_registration_follows')}</p>
            </div>
          )}
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100">
                {error}
              </div>
            )}

            {isRegistering && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('last_name')}</label>
                    <input
                      type="text"
                      required
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('first_name')}</label>
                    <input
                      type="text"
                      required
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('role')}</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as User['role'])}
                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                  >
                    <option value="élève">{t('student')}</option>
                    <option value="parent">{t('role_parent')}</option>
                    <option value="enseignant">{t('teacher')}</option>
                    <option value="personnel administratif">{t('admin_staff')}</option>
                    {/* Only show Admin option if the email matches or if it's not being typed yet */}
                    {(email.toLowerCase() === 'martinienmvezogo@gmail.com' || !email) && (
                      <option value="admin">{t('admin')}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('matricule_optional')}</label>
                  <input
                    type="text"
                    value={matricule}
                    onChange={(e) => setMatricule(e.target.value)}
                    placeholder="Ex: 2023-001"
                    className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                {role === 'élève' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('class')}</label>
                      <select
                        required
                        value={classe}
                        onChange={(e) => setClasse(e.target.value)}
                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                      >
                        <option value="">{t('select_class') || 'Sélectionner une classe'}</option>
                        {classes.map(cls => (
                          <option key={cls.id} value={cls.nom}>{cls.nom}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('house_optional')}</label>
                      <select
                        value={houseId}
                        onChange={(e) => setHouseId(e.target.value)}
                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                      >
                        <option value="">{t('no_house')}</option>
                        {houses.map(house => (
                          <option key={house.id} value={house.id}>{house.nom_maison}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {role === 'personnel administratif' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Responsabilité / Poste</label>
                    <select
                      required
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
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
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('email')}
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="exemple@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('password')}
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-colors"
              >
                {loading ? (
                  <RefreshCw className="animate-spin" size={20} />
                ) : isRegistering ? (
                  <UserPlus size={20} />
                ) : (
                  <ShieldCheck size={20} />
                )}
                {loading ? t('verifying') : isRegistering ? t('continue_step_2') : t('login_button')}
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              {isRegistering ? t('already_have_account') : t('no_account_yet')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
