import React, { useState } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  ShieldAlert, 
  Copy, 
  Check, 
  Sparkles, 
  AlertCircle, 
  Laptop, 
  Calendar,
  Lock,
  Unlock,
  Building,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

export default function ActivationModal({ isOpen, licenseInfo, onActivated, onClose, isManageMode = false }) {
  const { t, isRTL } = useLanguage();
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleCopyMachineId = () => {
    if (licenseInfo?.machineId) {
      navigator.clipboard.writeText(licenseInfo.machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) {
      setError('Veuillez coller ou saisir votre clé de licence.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccessMsg('');

      const res = await api.license.activate(licenseKeyInput.trim());
      if (res.success) {
        setSuccessMsg(res.message || 'Licence activée avec succès !');
        setLicenseKeyInput('');
        setTimeout(() => {
          if (onActivated) onActivated();
        }, 1000);
      } else {
        setError(res.error || 'Clé de licence non valide.');
      }
    } catch (err) {
      setError(err.message || 'Erreur lors de l’activation.');
    } finally {
      setLoading(false);
    }
  };

  const handleKillLicense = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir révoquer et annuler cette licence sur ce PC ?\n\nL'application sera immédiatement reverrouillée et nécessitera une nouvelle clé d'activation.")) {
      try {
        setLoading(true);
        setError('');
        const res = await api.license.deactivate();
        if (res.success) {
          setSuccessMsg('Licence révoquée et annulée avec succès.');
          setLicenseKeyInput('');
          setTimeout(() => {
            if (onActivated) onActivated();
          }, 800);
        } else {
          setError(res.error || 'Erreur lors de la révocation.');
        }
      } catch (err) {
        setError(err.message || 'Erreur lors de la révocation de licence.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none modal-backdrop"
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-content modal-container bg-slate-900 border border-slate-800 text-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative p-6 bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-slate-900 border-b border-slate-800 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-3 shadow-lg shadow-blue-500/10">
            {licenseInfo?.isActivated ? (
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            ) : (
              <Lock className="w-8 h-8 text-blue-400" />
            )}
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">
            {licenseInfo?.isActivated ? 'Gestionnaire de Licence' : 'Activation de Commerce Pro'}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {licenseInfo?.isActivated
              ? 'Votre application est activée et authentifiée pour ce poste.'
              : 'Pour déverrouiller et utiliser le logiciel, activez votre licence matérielle.'}
          </p>

          {isManageMode && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xs font-bold px-2 py-1 bg-slate-800/80 hover:bg-slate-800 rounded-lg transition"
            >
              Fermer
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-semibold rounded-2xl flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Active License Details (if activated) */}
          {licenseInfo?.isActivated && (
            <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-blue-400" /> Client / Entreprise :
                </span>
                <span className="text-xs font-black text-white">{licenseInfo.clientName}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Type de Licence :
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-900/60 text-emerald-300 border border-emerald-700/60">
                  {licenseInfo.type === 'LIFETIME' ? 'À VIE (Illimitée)' : 'TEMPORAIRE'}
                </span>
              </div>

              {licenseInfo.type === 'TIME_LIMITED' && licenseInfo.expiryDate && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-400" /> Date d'expiration :
                  </span>
                  <span className="text-xs font-bold text-amber-300">
                    {new Date(licenseInfo.expiryDate).toLocaleDateString('fr-DZ')} ({licenseInfo.daysRemaining} jours restants)
                  </span>
                </div>
              )}

              {/* Bouton Kill / Révoquer la licence */}
              <div className="pt-3 border-t border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">Pour changer de client ou annuler l'activation :</span>
                <button
                  type="button"
                  onClick={handleKillLicense}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-600/50 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Kill / Annuler Licence</span>
                </button>
              </div>
            </div>
          )}

          {/* Machine ID Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-300 flex items-center gap-1.5">
                <Laptop className="w-4 h-4 text-blue-400" /> Empreinte Matérielle du PC (Machine ID)
              </label>
              <span className="text-[10px] text-slate-400">Unique à cet ordinateur</span>
            </div>

            <div className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-2xl">
              <input
                type="text"
                readOnly
                value={licenseInfo?.machineId || 'Détection en cours...'}
                className="flex-1 bg-transparent px-3 py-1 text-sm font-mono font-black text-blue-400 tracking-wider focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleCopyMachineId}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              💡 <strong>Instructions :</strong> Copiez ce code machine et transmettez-le à votre éditeur pour générer votre clé d'activation sécurisée.
            </p>
          </div>

          {/* Key Input Form */}
          <form onSubmit={handleActivate} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-indigo-400" /> {licenseInfo?.isActivated ? 'Remplacer par une nouvelle clé' : 'Clé de Licence d\'Activation'}
              </label>
              <textarea
                rows={3}
                required
                value={licenseKeyInput}
                onChange={(e) => setLicenseKeyInput(e.target.value)}
                placeholder="Collez ici la clé fournie (ex: LIC-eyJjbGllbnQiOi...)"
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-mono font-medium text-slate-200 focus:border-blue-500 focus:outline-hidden placeholder:text-slate-600 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !licenseKeyInput.trim()}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Vérification de la clé...</span>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>{licenseInfo?.isActivated ? 'Mettre à Jour la Licence' : 'Activer l\'Application'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
