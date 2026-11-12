import React, { useState, useEffect } from 'react';
import { 
  CloudDownload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ExternalLink, 
  X, 
  ArrowUpCircle,
  FileText,
  ShieldCheck,
  Check
} from 'lucide-react';
import { api } from '../../services/api';

export default function UpdateModal({ isOpen, onClose, initialUpdateInfo = null }) {
  const [status, setStatus] = useState('IDLE'); // 'IDLE' | 'CHECKING' | 'AVAILABLE' | 'UP_TO_DATE' | 'DOWNLOADING' | 'DOWNLOADED' | 'ERROR'
  const [updateInfo, setUpdateInfo] = useState(initialUpdateInfo);
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState({ percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 });

  useEffect(() => {
    if (!isOpen) return;

    if (initialUpdateInfo) {
      setUpdateInfo(initialUpdateInfo);
      if (initialUpdateInfo.hasUpdate) {
        setStatus('AVAILABLE');
      } else {
        setStatus('UP_TO_DATE');
      }
    } else {
      handleCheck();
    }
  }, [isOpen, initialUpdateInfo]);

  useEffect(() => {
    // Écouter la progression du téléchargement
    const removeProgress = api.updater?.onProgress?.((data) => {
      setStatus('DOWNLOADING');
      setProgress(data);
    });

    // Écouter le statut de mise à jour (téléchargé ou erreur)
    const removeStatus = api.updater?.onStatus?.((data) => {
      if (data.status === 'DOWNLOADED') {
        setStatus('DOWNLOADED');
      } else if (data.status === 'ERROR') {
        setStatus('ERROR');
        setErrorMsg(data.error || 'Erreur lors du téléchargement de la mise à jour.');
      }
    });

    return () => {
      if (typeof removeProgress === 'function') removeProgress();
      if (typeof removeStatus === 'function') removeStatus();
    };
  }, []);

  const handleCheck = async () => {
    try {
      setStatus('CHECKING');
      setErrorMsg('');
      const res = await api.updater.check();

      if (!res.success) {
        setStatus('ERROR');
        setErrorMsg(res.error || 'Impossible de vérifier les mises à jour.');
        return;
      }

      setUpdateInfo(res);
      if (res.hasUpdate) {
        setStatus('AVAILABLE');
      } else {
        setStatus('UP_TO_DATE');
      }
    } catch (err) {
      setStatus('ERROR');
      setErrorMsg(err.message || 'Erreur lors de la vérification.');
    }
  };

  const handleSimulateTest = () => {
    setStatus('AVAILABLE');
    setUpdateInfo({
      success: true,
      hasUpdate: true,
      currentVersion: updateInfo?.currentVersion || '1.0.0',
      latestVersion: '1.0.1',
      releaseNotes: `🚀 Nouveautés Commerce Pro v1.0.1 :
• Module SAV : Impression optimisée des tickets 80mm
• Caisse & POS : Raccourcis ultra-rapides et calcul instantané de la monnaie
• Stock : Détection instantanée des seuils d'alerte et alertes rupture
• Mises à jour : Téléchargement automatique 1-clic direct avec barre de progression
• Préservation intégrale et permanente de toutes vos données et licences`,
      releaseDate: new Date().toISOString(),
      canAutoDownload: true,
      isSimulation: true
    });
  };

  const handleDownload = async () => {
    if (!updateInfo) return;

    if (updateInfo.isSimulation) {
      setStatus('DOWNLOADING');
      setProgress({ percent: 0, transferred: 0, total: 42 * 1024 * 1024, bytesPerSecond: 0 });

      let currentPercent = 0;
      const totalBytes = 42 * 1024 * 1024; // 42 Mo simulation
      const interval = setInterval(() => {
        currentPercent += Math.floor(Math.random() * 8) + 6;
        if (currentPercent >= 100) {
          currentPercent = 100;
          clearInterval(interval);
          setProgress({
            percent: 100,
            transferred: totalBytes,
            total: totalBytes,
            bytesPerSecond: 5.4 * 1024 * 1024
          });
          setTimeout(() => {
            setStatus('DOWNLOADED');
          }, 350);
        } else {
          const transferred = Math.round((currentPercent / 100) * totalBytes);
          const bytesPerSecond = Math.round((3.2 + Math.random() * 2.5) * 1024 * 1024);
          setProgress({
            percent: currentPercent,
            transferred,
            total: totalBytes,
            bytesPerSecond
          });
        }
      }, 200);
      return;
    }

    if (updateInfo.canAutoDownload) {
      try {
        setStatus('DOWNLOADING');
        setProgress({ percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 });
        const res = await api.updater.download(updateInfo.downloadUrl);
        if (!res.success && !res.openedBrowser) {
          api.updater.openReleaseUrl(updateInfo.downloadUrl || updateInfo.releaseUrl);
        }
      } catch (err) {
        api.updater.openReleaseUrl(updateInfo.downloadUrl || updateInfo.releaseUrl);
      }
    } else {
      // Téléchargement direct depuis GitHub
      api.updater.openReleaseUrl(updateInfo.downloadUrl || updateInfo.releaseUrl);
    }
  };

  const handleInstall = async () => {
    if (updateInfo?.isSimulation) {
      alert("✅ Test de mise à jour réussi !\n\nEn situation réelle, Commerce Pro se ferme, applique la nouvelle version et redémarre instantanément en conservant toutes vos données.");
      setStatus('UP_TO_DATE');
      return;
    }
    try {
      await api.updater.install();
    } catch (err) {
      setErrorMsg('Erreur lors du lancement de l’installateur: ' + err.message);
    }
  };

  const handleOpenBrowser = () => {
    api.updater.openReleaseUrl(updateInfo?.releaseUrl || 'https://github.com/hakimabderrahim18/CommercePro/releases');
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0) return '0 Mo';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} Mo`;
  };

  const formatSpeed = (bytesPerSec) => {
    if (!bytesPerSec || bytesPerSec <= 0) return '';
    const mb = bytesPerSec / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} Mo/s`;
    const kb = bytesPerSec / 1024;
    return `${kb.toFixed(0)} Ko/s`;
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative p-6 bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <CloudDownload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Mise à jour en ligne</h2>
              <p className="text-xs text-slate-400">Commerce Pro • GitHub Releases</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* 1. Statut : CHECKING */}
          {status === 'CHECKING' && (
            <div className="py-8 text-center space-y-3">
              <RefreshCw className="w-10 h-10 mx-auto text-blue-400 animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">Recherche de mise à jour...</p>
                <p className="text-xs text-slate-400">Connexion au serveur GitHub Releases</p>
              </div>
            </div>
          )}

          {/* 2. Statut : UP_TO_DATE */}
          {status === 'UP_TO_DATE' && (
            <div className="py-6 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Commerce Pro est à jour !</h3>
                <p className="text-xs text-slate-400">
                  Vous disposez déjà de la version la plus récente : <span className="font-mono font-bold text-emerald-400">v{updateInfo?.currentVersion || '1.0.0'}</span>
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleCheck}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-vérifier en ligne</span>
                </button>
                <button
                  type="button"
                  onClick={handleSimulateTest}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-bold rounded-xl border border-blue-500/30 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>🧪 Tester la mise à jour (Simulation)</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. Statut : AVAILABLE */}
          {status === 'AVAILABLE' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white">Nouvelle version disponible :</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-blue-600 text-white">
                      v{updateInfo?.latestVersion}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Version actuelle : <span className="font-mono text-slate-300">v{updateInfo?.currentVersion}</span>
                  </p>
                </div>
              </div>

              {/* Release Notes */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Nouveautés & Corrections :</span>
                </div>
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl max-h-40 overflow-y-auto text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                  {updateInfo?.releaseNotes || 'Améliorations générales et corrections de stabilité.'}
                </div>
              </div>

              {/* Note données protégées */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Vos stocks, ventes, clients et votre licence restent préservés à 100%.</span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  <span>{updateInfo?.canAutoDownload ? 'Télécharger la mise à jour' : 'Télécharger (.exe depuis GitHub)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenBrowser}
                  className="py-3 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Voir la page GitHub Releases"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">GitHub</span>
                </button>
              </div>
            </div>
          )}

          {/* 4. Statut : DOWNLOADING */}
          {status === 'DOWNLOADING' && (
            <div className="py-4 space-y-4">
              <div className="space-y-1 text-center">
                <p className="text-sm font-bold text-white">Téléchargement de la mise à jour...</p>
                <p className="text-xs text-slate-400">Veuillez patienter pendant la récupération des fichiers</p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-blue-400">{progress.percent}%</span>
                  <span className="text-slate-400">
                    {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                    {progress.bytesPerSecond > 0 && ` (${formatSpeed(progress.bytesPerSecond)})`}
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
                  />
                </div>
              </div>

              <p className="text-[11px] text-center text-slate-500">
                Vous pouvez continuer à utiliser le logiciel pendant le téléchargement.
              </p>
            </div>
          )}

          {/* 5. Statut : DOWNLOADED */}
          {status === 'DOWNLOADED' && (
            <div className="py-4 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Check className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Mise à jour prête à être installée !</h3>
                <p className="text-xs text-slate-400">
                  L'application va se fermer, appliquer la mise à jour et redémarrer automatiquement.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleInstall}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Redémarrer et Installer maintenant</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Plus tard
                </button>
              </div>
            </div>
          )}

          {/* 6. Statut : ERROR */}
          {status === 'ERROR' && (
            <div className="py-4 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Impossible de contacter GitHub</h3>
                <p className="text-xs text-rose-300 max-w-sm mx-auto">{errorMsg}</p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
                <button
                  type="button"
                  onClick={handleCheck}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Réessayer</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenBrowser}
                  className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ouvrir GitHub Releases</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span>Dépôt officiel : hakimabderrahim18/CommercePro</span>
            <button
              type="button"
              onClick={handleSimulateTest}
              className="text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer"
            >
              (Test Démo)
            </button>
          </div>
          <span>Version actuelle : v{updateInfo?.currentVersion || '1.0.0'}</span>
        </div>
      </div>
    </div>
  );
}
