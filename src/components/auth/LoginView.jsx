import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  ArrowRight, 
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

export default function LoginView({ licenseInfo }) {
  const { login, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Veuillez renseigner votre identifiant utilisateur.');
      return;
    }
    if (!password.trim()) {
      setError('Veuillez renseigner votre mot de passe.');
      return;
    }

    setError('');
    const res = await login(username.trim(), password.trim());
    if (!res.success) {
      setError(res.error || 'Identifiant ou mot de passe incorrect.');
    }
  };

  return (
    <div 
      className="login-screen min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none"
      style={{
        backgroundColor: 'var(--sidebar-header-bg, #020617)'
      }}
    >
      {/* Background Glows */}
      <div 
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
      />
      <div 
        className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ backgroundColor: 'var(--color-primary, #4f46e5)' }}
      />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div 
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl font-black text-2xl"
            style={{
              background: `linear-gradient(135deg, var(--color-primary, #2563eb), color-mix(in srgb, var(--color-primary, #2563eb) 70%, black))`
            }}
          >
            CP
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Commerce<span style={{ color: 'var(--color-primary, #60a5fa)' }}>Pro</span>
          </h1>
          <p className="text-xs font-semibold text-slate-400">
            Gestion Commerciale, Caisse & Atelier de Réparation
          </p>
        </div>

        {/* Login Form Box */}
        <div 
          className="login-card bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl"
          style={{
            backgroundColor: 'var(--sidebar-bg, rgba(15, 23, 42, 0.9))',
            borderColor: 'var(--sidebar-border, #1e293b)'
          }}
        >
          <div className="mb-5 pb-3 border-b border-slate-800 text-center">
            <h2 className="text-sm font-black text-white uppercase tracking-wider">Connexion Session</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Veuillez saisir vos identifiants pour accéder à votre poste</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-300 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Identifiant / Nom d'utilisateur
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Saisissez votre identifiant..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-semibold focus:outline-blue-500 focus:border-blue-500 transition placeholder:text-slate-600"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Mot de Passe / Code PIN
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Saisissez votre mot de passe..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-semibold focus:outline-blue-500 focus:border-blue-500 transition placeholder:text-slate-600"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: `linear-gradient(135deg, var(--color-primary, #2563eb), color-mix(in srgb, var(--color-primary, #2563eb) 80%, black))`
              }}
              className="w-full mt-3 py-3 text-white font-black text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Vérification en cours...' : 'Se connecter'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center flex flex-col items-center gap-2">
            <span className="text-[11px] text-slate-500">
              CommercePost • Accès sécurisé multi-utilisateurs & caisses dédiées
            </span>
            {licenseInfo?.isActivated && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-[10px] font-bold text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Licence Validée : {licenseInfo.clientName || 'Poste Authentifié'} ({licenseInfo.type === 'LIFETIME' ? 'À vie' : `${licenseInfo.daysRemaining ?? '0'}j restants`})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
