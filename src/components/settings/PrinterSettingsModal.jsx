import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { 
  Printer, 
  Tag, 
  Receipt, 
  CheckCircle2, 
  Save, 
  RefreshCw, 
  HelpCircle,
  Sliders,
  Sparkles,
  Store,
  Phone,
  MapPin,
  FileText,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  Trash2,
  Palette,
  Check,
  Briefcase,
  Wrench,
  Boxes,
  ShoppingBag,
  Layers
} from 'lucide-react';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { 
  getPrinterSettings, 
  savePrinterSettings, 
  autoDetectPrinters, 
  LABEL_FORMATS, 
  generateLabelHtml, 
  generateReceiptHtml, 
  printHtmlContent,
  formatCurrencyDz
} from '../../utils/printerHelper';

export default function PrinterSettingsModal({ isOpen, onClose }) {
  const { currentColorId, changeThemeColor, colorsList } = useTheme();
  const [activeTab, setActiveTab] = useState('printers'); // 'printers' | 'appearance'
  const [printers, setPrinters] = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [settings, setSettings] = useState(getPrinterSettings());
  const [saveStatus, setSaveStatus] = useState(null);
  const [testStatus, setTestStatus] = useState(null);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide (PNG, JPG, SVG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSettings(prev => ({ ...prev, storeLogo: ev.target?.result || '' }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setSettings(prev => ({ ...prev, storeLogo: '' }));
  };

  const fetchPrinters = async () => {
    try {
      setLoadingPrinters(true);
      const res = await api.print.getPrinters();
      if (res && res.success && Array.isArray(res.data)) {
        setPrinters(res.data);
        // Détecter automatiquement si pas encore de choix
        const detected = autoDetectPrinters(res.data);
        setSettings(prev => ({
          ...prev,
          labelPrinter: prev.labelPrinter || detected.detectedXprinter || '',
          receiptPrinter: prev.receiptPrinter || detected.detectedSprt || ''
        }));
      }
    } catch (e) {
      console.error('Erreur getPrinters:', e);
    } finally {
      setLoadingPrinters(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSettings(getPrinterSettings());
      fetchPrinters();
    }
  }, [isOpen]);

  const handleSave = () => {
    savePrinterSettings(settings);
    setSaveStatus('Paramètres d’impression enregistrés avec succès !');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleTestLabelXprinter = async () => {
    setTestStatus('Impression étiquette test en cours sur Xprinter 350B...');
    const testProduct = {
      reference: '0086',
      codeBarre: '0086',
      nom: 'CHOP SINARCO LUX',
      categorie: 'Ménage',
      prixVente: 250,
      barcodeImage: ''
    };

    const fmt = LABEL_FORMATS[settings.labelFormat] || LABEL_FORMATS['30x30'];
    const w = settings.labelWidth || fmt.width || 30;
    const h = settings.labelHeight || fmt.height || 30;

    const html = generateLabelHtml({
      product: testProduct,
      quantity: 1,
      format: settings.labelFormat || '30x30',
      settings,
      rotation: settings.labelRotation || 0,
      customWidth: w,
      customHeight: h
    });

    const res = await printHtmlContent(html, {
      printerName: settings.labelPrinter,
      pageSize: { width: w * 1000, height: h * 1000 },
      landscape: settings.labelOrientation === 'landscape',
      silent: settings.silentPrint
    });

    if (res.success) {
      setTestStatus('✅ Étiquette test envoyée avec succès à la Xprinter 350B !');
    } else {
      setTestStatus(`❌ Erreur d'impression : ${res.error || 'Vérifiez la connexion de l’imprimante'}`);
    }
    setTimeout(() => setTestStatus(null), 4000);
  };

  const handleTestReceiptSprt = async () => {
    setTestStatus('Impression Ticket / Bon de Commande test en cours sur SPRT 80...');
    const testInvoice = {
      numeroFacture: '036009',
      typeDocument: 'BON_COMMANDE',
      caisse: 'Caisse 1 (Comptoir)',
      caissier: 'ILYES',
      client: { nom: 'R MOHAMED YESREF', telephone: '0550245000', soldeDette: 0 },
      items: [
        { nom: 'LCD SAM A13/M13/F13 BLINDE', reference: 'LCD-A13-BLINDE', quantite: 1, prixUnitaire: 2000, totalLigne: 2000 }
      ],
      totalHT: 2000,
      remise: 0,
      totalTTC: 2000,
      montantPaye: 2000,
      montantReste: 0
    };

    const html = generateReceiptHtml({
      invoice: testInvoice,
      docType: 'BON_COMMANDE',
      settings,
      rotation: settings.receiptRotation || 0,
      marginLeft: settings.receiptMarginLeft !== undefined ? settings.receiptMarginLeft : 0,
      contentWidth: settings.receiptContentWidth || 80
    });

    const res = await printHtmlContent(html, {
      printerName: settings.receiptPrinter,
      pageSize: { width: (settings.receiptPaperWidth === '58mm' ? 58 : 80) * 1000, height: 297000 },
      landscape: settings.receiptOrientation === 'landscape',
      silent: settings.silentPrint !== undefined ? settings.silentPrint : true,
      margins: { marginType: 'none' }
    });

    if (res.success) {
      setTestStatus('✅ Bon de Commande test envoyé avec succès à la SPRT 80 !');
    } else {
      setTestStatus(`❌ Erreur d'impression : ${res.error || 'Vérifiez la connexion de la SPRT 80'}`);
    }
    setTimeout(() => setTestStatus(null), 4000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Paramètres de l'Application & Matériel"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6 text-slate-800">
        {/* Navigation Tabs : Matériel d'Impression vs Couleurs & Thème */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('printers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'printers'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Matériel d'Impression & Magasin</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'activity'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Activité, Métier & SAV</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'appearance'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Couleurs & Thème de l'Application</span>
          </button>
        </div>

        {/* Global Save Notification Toast */}
        {saveStatus && (
          <div className="p-3 bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 rounded-xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>{saveStatus}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveStatus(null)}
              className="text-emerald-100 hover:text-white text-xs font-black px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab 3 : Activité, Métier, Formulaire Produit & SAV */}
        {activeTab === 'activity' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Status notification */}
            {saveStatus && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{saveStatus}</span>
              </div>
            )}

            {/* SECTION 1: NOM DU MAGASIN SUR LES ÉTIQUETTES & TICKETS */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    Nom de l'Établissement sur les Étiquettes & Tickets
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ce nom s'imprime en en-tête de toutes vos étiquettes code-barres et de vos tickets de caisse. Le code-barres reste intact.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nom du Magasin / Enseigne :
                  </label>
                  <input
                    type="text"
                    value={settings.storeName || ''}
                    onChange={(e) => {
                      const updated = { ...settings, storeName: e.target.value };
                      setSettings(updated);
                      savePrinterSettings(updated);
                    }}
                    placeholder="Ex: NOUNOU TELECOM ou IYAD MENAGE"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Synchronisé en temps réel sur toutes vos étiquettes code-barres et bons de commande / tickets.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Sous-titre / Spécialité :
                  </label>
                  <input
                    type="text"
                    value={settings.storeSubtitle || ''}
                    onChange={(e) => {
                      const updated = { ...settings, storeSubtitle: e.target.value };
                      setSettings(updated);
                      savePrinterSettings(updated);
                    }}
                    placeholder="Ex: VENTE PIECE MOBILE & RÉPARATION"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: TYPE D'ACTIVITÉ COMMERCIALE (FORMULAIRE PRODUIT ADAPTATIF) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    Secteur d'Activité Commerciale (Formulaire Produit Adaptatif)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Le formulaire de création de produit s'adaptera automatiquement à l'activité sélectionnée ci-dessous.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: 'pieces_detachees',
                    icon: Wrench,
                    title: 'Pièces Détachées, Smartphones & IT',
                    badge: 'Recommandé Atelier',
                    desc: 'Optimisé pour Référence constructeur, Marque, Modèle, Compatibilité. Masque les tailles vestimentaires.'
                  },
                  {
                    id: 'vetements',
                    icon: ShoppingBag,
                    title: 'Vêtements, Chaussures & Mode',
                    badge: 'Prêt-à-porter',
                    desc: 'Affiche Tailles (S, M, L, XL...), Pointures (36, 37, 38...), Nuancier de Couleurs, et Genre (Homme/Femme/Enfant).'
                  },
                  {
                    id: 'alimentation',
                    icon: Boxes,
                    title: 'Alimentation Générale & Supérette',
                    badge: 'Épicerie / Agro',
                    desc: 'Priorité aux unités (kg, g, litre, carton, paquet), dates limites (DLC / DLUO) et conditionnement.'
                  },
                  {
                    id: 'general',
                    icon: Layers,
                    title: 'Commerce Standard / Quincaillerie',
                    badge: 'Polyvalent',
                    desc: 'Formulaire standard polyvalent adapté à la vente au détail sans champs spécifiques.'
                  }
                ].map((act) => {
                  const isSelected = (settings.activityType || 'pieces_detachees') === act.id;
                  const Icon = act.icon;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setSettings({ ...settings, activityType: act.id })}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`p-2 rounded-xl ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {act.badge}
                        </span>
                      </div>
                      <div>
                        <div className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                          <span>{act.title}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 stroke-[3]" />}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          {act.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* OPTION PRIX DE SÉRIE */}
              <div className="pt-3 border-t border-slate-100">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableSeriePricing !== false}
                    onChange={(e) => setSettings({ ...settings, enableSeriePricing: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      Activer la gestion du Prix de Série & Colis (Vente en lot)
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Affiche dans la fiche produit les champs "Prix de la Série" et "Nombre de pièces par série" pour le calcul automatique du tarif de lot.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* SECTION 3: MODE DU SERVICE DE RÉPARATION (WORKFLOW SAV) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    Mode d'Organisation du Service Réparation (SAV)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Choisissez la disposition de travail pour la gestion des réparations et de l'atelier.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option Dinateck Pro */}
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, repairWorkflowMode: 'dinateck' })}
                  className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 ${
                    (settings.repairWorkflowMode || 'dinateck') === 'dinateck'
                      ? 'border-blue-600 bg-blue-50/60 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-600 text-white uppercase">
                      ⭐ Mode Dinateck Pro (Photos Atelier)
                    </span>
                    {(settings.repairWorkflowMode || 'dinateck') === 'dinateck' && (
                      <Check className="w-4 h-4 text-blue-600 stroke-[3]" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-xs text-slate-900">Interface Dinateck Complète</h4>
                    <ul className="text-[11px] text-slate-600 space-y-1 mt-1.5 list-disc pl-4">
                      <li>Stepper 5 étapes (Reçu, Diagnostic, Réparation, Terminé, Livré)</li>
                      <li>5 Onglets : Informations, Travaux (MO + Pièces stock), Financier, Documents, Historique</li>
                      <li><strong>Données modifiables à tout moment et à toutes les étapes</strong></li>
                      <li>Impression directe Bon de réception, Fiche réparation, Devis, Facture</li>
                    </ul>
                  </div>
                </button>

                {/* Option Standard */}
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, repairWorkflowMode: 'standard' })}
                  className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 ${
                    settings.repairWorkflowMode === 'standard'
                      ? 'border-blue-600 bg-blue-50/60 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-200 text-slate-700 uppercase">
                      Mode Standard (3 Sections)
                    </span>
                    {settings.repairWorkflowMode === 'standard' && (
                      <Check className="w-4 h-4 text-blue-600 stroke-[3]" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-xs text-slate-900">Workflow Standard Simplifié</h4>
                    <ul className="text-[11px] text-slate-600 space-y-1 mt-1.5 list-disc pl-4">
                      <li>Séparation en 3 écrans : Réception, Atelier en cours, Livraison & Caisse</li>
                      <li>Gestion rapide au comptoir</li>
                    </ul>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2 : Personnalisation des Couleurs de l'Application */}
        {activeTab === 'appearance' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    Palette de Couleurs & Thème Visuel
                  </h3>
                  <p className="text-xs text-slate-500">
                    Choisissez la couleur principale pour personnaliser les boutons, l'en-tête, les badges et l'interface de CommercePost.
                  </p>
                </div>
              </div>

              {/* Grille de sélection des thèmes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                {colorsList.map((color) => {
                  const isSelected = currentColorId === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => changeThemeColor(color.id)}
                      className={`relative p-3.5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 group ${
                        isSelected 
                          ? 'border-slate-900 bg-slate-50/80 shadow-md scale-102 ring-2 ring-blue-500/20' 
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      {/* Pastille de prévisualisation */}
                      <div className="flex items-center justify-between">
                        <div 
                          className="w-8 h-8 rounded-xl shadow-xs flex items-center justify-center text-white"
                          style={{ backgroundColor: color.primary }}
                        >
                          {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                        </div>
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-900 text-white uppercase tracking-wider">
                            Actif
                          </span>
                        )}
                      </div>

                      {/* Nom et détails */}
                      <div>
                        <div className="font-black text-xs text-slate-900">{color.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color.primary }} />
                          {color.primary}
                        </div>
                      </div>

                      {/* Barre d'échantillons de dégradé */}
                      <div className="w-full h-1.5 rounded-full bg-gradient-to-r" style={{
                        background: `linear-gradient(to right, ${color.primary}, ${color.primaryHover})`
                      }} />
                    </button>
                  );
                })}
              </div>

              {/* Aperçu interactif immédiat */}
              <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full animate-ping" style={{ backgroundColor: 'var(--color-primary)' }} />
                  <span className="text-xs font-bold text-slate-700">
                    Aperçu de la couleur active appliquée sur le logiciel en direct
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    Badge dynamique
                  </span>
                  <button
                    type="button"
                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 shadow-xs"
                  >
                    Bouton Action
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1 : Matériel d'impression & Coordonnées du Magasin */}
        {activeTab === 'printers' && (
          <div className="space-y-6 animate-in fade-in duration-150">
        {/* Status notification */}
        {saveStatus && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{saveStatus}</span>
          </div>
        )}

        {testStatus && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            testStatus.startsWith('✅') ? 'bg-blue-50 border border-blue-200 text-blue-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            <Printer className="w-4 h-4" />
            <span>{testStatus}</span>
          </div>
        )}

        {/* SECTION 1: XPRINTER XP-350B (ÉTIQUETTES CODE-BARRES) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <span>Imprimante Étiquettes Code-Barres</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black rounded-md">
                    Xprinter XP-350B
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Impression thermique directe 203 DPI pour rouleaux d'étiquettes adhésives
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestLabelXprinter}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Tester Étiquette</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Imprimante sélectionnée */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Périphérique Windows (Xprinter) :
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={settings.labelPrinter}
                  onChange={(e) => setSettings({ ...settings, labelPrinter: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
                >
                  <option value="">-- Sélectionner l'imprimante Xprinter --</option>
                  {printers.map((p, idx) => (
                    <option key={idx} value={p.name}>
                      {p.name} {p.isDefault ? '(Par défaut Windows)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={fetchPrinters}
                  disabled={loadingPrinters}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                  title="Actualiser les imprimantes"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingPrinters ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Format d'étiquette */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Format de l'étiquette :
              </label>
              <select
                value={settings.labelFormat}
                onChange={(e) => {
                  const newFmt = e.target.value;
                  const targetFmt = LABEL_FORMATS[newFmt];
                  setSettings({ 
                    ...settings, 
                    labelFormat: newFmt,
                    labelWidth: targetFmt?.width || settings.labelWidth || 30,
                    labelHeight: targetFmt?.height || settings.labelHeight || 30,
                    labelRotation: targetFmt?.rotation !== undefined ? targetFmt.rotation : settings.labelRotation
                  });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
              >
                {Object.entries(LABEL_FORMATS).map(([key, fmt]) => (
                  <option key={key} value={key}>
                    {fmt.label}
                  </option>
                ))}
              </select>

              {/* Dimensions personnalisées en mm */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-[10px] text-slate-500 font-bold">Largeur :</span>
                  <input
                    type="number"
                    min="20"
                    max="120"
                    value={settings.labelWidth || 30}
                    onChange={(e) => setSettings({ ...settings, labelWidth: parseInt(e.target.value, 10) || 30 })}
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold text-xs"
                  />
                  <span className="text-[10px] text-slate-400">mm</span>
                </div>
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-[10px] text-slate-500 font-bold">Hauteur :</span>
                  <input
                    type="number"
                    min="15"
                    max="150"
                    value={settings.labelHeight || 30}
                    onChange={(e) => setSettings({ ...settings, labelHeight: parseInt(e.target.value, 10) || 30 })}
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold text-xs"
                  />
                  <span className="text-[10px] text-slate-400">mm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Orientation & Rotation Xprinter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Format rapide :
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, labelFormat: '30x30', labelWidth: 30, labelHeight: 30, labelRotation: 0 })}
                  className={`flex-1 min-w-[120px] py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    settings.labelFormat === '30x30'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  30 × 30 mm (⭐ Actuel)
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, labelFormat: '45x35', labelWidth: 45, labelHeight: 35, labelRotation: 0 })}
                  className={`flex-1 min-w-[120px] py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    settings.labelFormat === '45x35'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  45 × 35 mm
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, labelFormat: '35x45', labelWidth: 35, labelHeight: 45, labelRotation: 0 })}
                  className={`flex-1 min-w-[120px] py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    settings.labelFormat === '35x45'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  35 × 45 mm
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, labelFormat: '50x30', labelWidth: 50, labelHeight: 30, labelRotation: 0 })}
                  className={`flex-1 min-w-[120px] py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    settings.labelFormat === '50x30'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  50 × 30 mm
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, labelFormat: '40x30', labelWidth: 40, labelHeight: 30, labelRotation: 0 })}
                  className={`flex-1 min-w-[120px] py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    settings.labelFormat === '40x30'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  40 × 30 mm
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, labelFormat: '30x20', labelWidth: 30, labelHeight: 20, labelRotation: 0 })}
                  className={`flex-1 min-w-[100px] py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    settings.labelFormat === '30x20'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  30 × 20 mm
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Type de Code-Barres (Symbologie) :
              </label>
              <select
                value={settings.labelBarcodeType || 'CODE128'}
                onChange={(e) => setSettings({ ...settings, labelBarcodeType: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
              >
                <option value="CODE128">⭐ CODE 128 (Recommandé - Lecture instantanée toute douchette)</option>
                <option value="CODE39">CODE 39 (Standard alphanumérique)</option>
                <option value="EAN13">EAN-13 (Grandes surfaces 13 chiffres)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Rotation manuelle :
              </label>
              <select
                value={settings.labelRotation || 0}
                onChange={(e) => setSettings({ ...settings, labelRotation: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
              >
                <option value={0}>0° (Normal)</option>
                <option value={90}>90° (Rotation Verticale horaire)</option>
                <option value={180}>180° (Inversé tête-bêche)</option>
                <option value={270}>270° (Rotation anti-horaire)</option>
              </select>
            </div>
          </div>

          {/* Options d'affichage étiquette */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-4 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.labelShowStore}
                onChange={(e) => setSettings({ ...settings, labelShowStore: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-700">Afficher l'En-tête Magasin</span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.labelShowCategory}
                onChange={(e) => setSettings({ ...settings, labelShowCategory: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-700">Afficher la Catégorie</span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.labelShowAttributes}
                onChange={(e) => setSettings({ ...settings, labelShowAttributes: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-700">Afficher Taille / Pointure / Couleur</span>
            </label>
          </div>
        </div>

        {/* SECTION 2: SPRT 80 (BONS DE COMMANDE & TICKETS THERMIQUES 80MM) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <span>Imprimante Thermique Bons & Tickets</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md">
                    SPRT 80 (80mm)
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Rouleau thermique continu 80mm pour Bons de Commande (vente/achat) & Tickets de Caisse
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestReceiptSprt}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Tester Bon de Commande</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Périphérique Windows */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">
                  Périphérique Windows (SPRT / POS-80) :
                </label>
                <button
                  type="button"
                  onClick={fetchPrinters}
                  disabled={loadingPrinters}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                  title="Rafraîchir la liste des imprimantes connectées"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingPrinters ? 'animate-spin' : ''}`} />
                  <span>Actualiser</span>
                </button>
              </div>
              <select
                value={settings.receiptPrinter}
                onChange={(e) => setSettings({ ...settings, receiptPrinter: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
              >
                <option value="">-- Sélectionner l'imprimante SPRT 80 --</option>
                {printers.map((p, idx) => (
                  <option key={idx} value={p.name}>
                    {p.name} {p.isDefault ? '(Par défaut Windows)' : ''}
                  </option>
                ))}
              </select>

              {/* Guide si aucune imprimante thermique physique n'est détectée */}
              {printers.length > 0 && !printers.some(p => {
                const n = (p.name || '').toLowerCase();
                return !n.includes('pdf') && !n.includes('xps') && !n.includes('fax') && !n.includes('writer') && !n.includes('onenote');
              }) && (
                <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1.5">
                  <div className="font-black flex items-center gap-1.5 text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Imprimante 80mm non reconnue par Windows</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Windows ne liste actuellement que des imprimantes virtuelles (PDF/XPS). Pour que l’impression directe du bon de commande fonctionne :
                  </p>
                  <ol className="list-decimal list-inside text-[11px] space-y-1 text-amber-950 font-medium">
                    <li>Branchez le câble USB de l’imprimante 80mm au PC et allumez-la.</li>
                    <li>Installez son pilote Windows (pilote <b>POS-80</b> ou <b>SPRT</b> fourni ou via Windows : <i>Paramètres &gt; Imprimantes &gt; Ajouter manuellement sur port USB001</i>).</li>
                    <li>Cliquez sur <b>Actualiser</b> ci-dessus pour la sélectionner.</li>
                  </ol>
                </div>
              )}
            </div>

            {/* Largeur papier */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Largeur du Rouleau :
              </label>
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 text-xs">
                80 mm (Imprimantes SPRT 80 / POS-80)
              </div>
            </div>
          </div>

          {/* Orientation & Rotation SPRT 80 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1 border-t border-slate-100">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Orientation du Bon / Ticket :
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, receiptOrientation: 'portrait', receiptRotation: 0 })}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    (settings.receiptOrientation || 'portrait') === 'portrait'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Verticale (Portrait) ⭐
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, receiptOrientation: 'landscape' })}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    settings.receiptOrientation === 'landscape'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Horizontale
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Rotation manuelle (Correction pilote) :
              </label>
              <select
                value={settings.receiptRotation || 0}
                onChange={(e) => setSettings({ ...settings, receiptRotation: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-emerald-500"
              >
                <option value={0}>0° (Normal - Verticale)</option>
                <option value={90}>90° (Rotation 90° horaire)</option>
                <option value={180}>180° (Inversé tête-bêche)</option>
                <option value={270}>270° (Rotation 270° anti-horaire)</option>
              </select>
            </div>
          </div>

          {/* Centrage et Décalage SPRT 80 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1 border-t border-slate-100">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Décalage à gauche (Marge rouleau) :
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="35"
                  value={settings.receiptMarginLeft !== undefined ? settings.receiptMarginLeft : 0}
                  onChange={(e) => setSettings({ ...settings, receiptMarginLeft: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center focus:bg-white focus:outline-emerald-500"
                />
                <span className="text-slate-600 font-bold">mm</span>
                <span className="text-[11px] text-slate-400">(Recommandé : 0 mm pour pleine page)</span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Largeur utile du texte :
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="40"
                  max="80"
                  value={settings.receiptContentWidth || 80}
                  onChange={(e) => setSettings({ ...settings, receiptContentWidth: Math.max(40, parseInt(e.target.value, 10) || 80) })}
                  className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center focus:bg-white focus:outline-emerald-500"
                />
                <span className="text-slate-600 font-bold">mm</span>
                <span className="text-[11px] text-slate-400">(Recommandé : 80 mm - Pleine largeur 100%)</span>
              </div>
            </div>
          </div>

          {/* Configuration des Décimales / Chiffres après la virgule */}
          <div className="pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Format des Prix (Chiffres après la virgule) :
                </label>
                <select
                  value={settings.receiptDecimals !== undefined ? String(settings.receiptDecimals) : '0'}
                  onChange={(e) => {
                    const val = e.target.value === 'auto' ? 'auto' : parseInt(e.target.value, 10);
                    const updated = { ...settings, receiptDecimals: val };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-emerald-500"
                >
                  <option value="0">0 décimale (Ex: 1 250 DA - Entier Dinar Algérien sans centimes) ⭐</option>
                  <option value="2">2 décimales (Ex: 1 250.00 DA - Affichage avec centimes)</option>
                  <option value="auto">Automatique (Ex: 1 250 DA si entier, 1 250.50 DA si décimales)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Configure l'affichage de tous les montants et totaux sur les tickets, bons de commande et en caisse.
                </p>
              </div>

              <div className="flex items-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl w-full">
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">Aperçu du prix affiché :</span>
                  <span className="text-base font-black text-slate-900">
                    {formatCurrencyDz(1250, settings.receiptDecimals)} DA
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {settings.receiptDecimals === 2 ? 'Affichage précis avec deux zéros (.00)' : settings.receiptDecimals === 'auto' ? 'Affichage dynamique selon présence de centimes' : 'Affichage net et épuré sans centimes inutiles'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION : FORMAT D'IMPRESSION DES SITUATIONS (CLIENT & FOURNISSEUR) */}
          <div className="pt-3 border-t border-slate-100">
            <label className="block font-bold text-slate-800 text-xs mb-1.5 flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-emerald-600" />
              <span>Format d'Impression de la Situation (Client / Fournisseur / Relevé) :</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                (settings.situationPrintFormat || '80mm') === '80mm'
                  ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}>
                <input
                  type="radio"
                  name="situationPrintFormat"
                  value="80mm"
                  checked={(settings.situationPrintFormat || '80mm') === '80mm'}
                  onChange={() => {
                    const updated = { ...settings, situationPrintFormat: '80mm' };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="block font-black">🧾 Ticket Thermique 80 mm (SPRT 80 / Rouleau) ⭐</span>
                  <span className="text-[10px] font-normal text-slate-500 block mt-0.5">
                    Impression directe sur ticket de caisse avec solde dette, coordonnées et historique des derniers bons.
                  </span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                settings.situationPrintFormat === 'A4'
                  ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}>
                <input
                  type="radio"
                  name="situationPrintFormat"
                  value="A4"
                  checked={settings.situationPrintFormat === 'A4'}
                  onChange={() => {
                    const updated = { ...settings, situationPrintFormat: 'A4' };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="block font-black">📄 Format Standard A4 (Pleine Page)</span>
                  <span className="text-[10px] font-normal text-slate-500 block mt-0.5">
                    Relevé officiel pleine page avec tableau des opérations et détail pour archivage.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* SECTION : CONFIGURATION DE TOUS LES ATTRIBUTS DES BONS DE COMMANDE & TICKETS */}
          <div className="pt-3 border-t border-slate-100">
            <div className="mb-2">
              <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Attributs et Blocs Affichés sur les Bons de Commande & Tickets :</span>
              </label>
              <p className="text-[11px] text-slate-500">
                Activez ou désactivez les blocs et mentions qui doivent s'imprimer sur chaque bon :
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
              {/* En-tête magasin */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.receiptShowStoreHeader !== false}
                  onChange={(e) => {
                    const updated = { ...settings, receiptShowStoreHeader: e.target.checked };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">En-tête Magasin</span>
              </label>

              {/* Ligne NBR ART */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.receiptShowNbrArt !== false}
                  onChange={(e) => {
                    const updated = { ...settings, receiptShowNbrArt: e.target.checked };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Nombre d'articles (NBR ART)</span>
              </label>

              {/* Total brut */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.receiptShowTotalBrut !== false}
                  onChange={(e) => {
                    const updated = { ...settings, receiptShowTotalBrut: e.target.checked };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Total Brut</span>
              </label>

              {/* Remise */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.receiptShowRemise !== false}
                  onChange={(e) => {
                    const updated = { ...settings, receiptShowRemise: e.target.checked };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Ligne Remise</span>
              </label>

              {/* TTC A PAYER */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.receiptShowTtcAPayer !== false}
                  onChange={(e) => {
                    const updated = { ...settings, receiptShowTtcAPayer: e.target.checked };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">TTC à Payer</span>
              </label>

              {/* Ancien Solde */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.receiptShowAncienSolde !== false}
                  onChange={(e) => {
                    const updated = { ...settings, receiptShowAncienSolde: e.target.checked };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Ancien Solde Client</span>
              </label>

              {/* Total achat */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.receiptShowTotalAchat !== false}
                  onChange={(e) => {
                    const updated = { ...settings, receiptShowTotalAchat: e.target.checked };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Total Achat du Bon</span>
              </label>

              {/* Versement */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.receiptShowVersement !== false}
                  onChange={(e) => {
                    const updated = { ...settings, receiptShowVersement: e.target.checked };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Montant Versé / Reçu</span>
              </label>

              {/* Nouveau Solde */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.receiptShowNouveauSolde !== false}
                  onChange={(e) => {
                    const updated = { ...settings, receiptShowNouveauSolde: e.target.checked };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Nouveau Solde Dette</span>
              </label>

              {/* Nom du Client */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.receiptShowCustomerName !== false}
                  onChange={(e) => {
                    const updated = { ...settings, receiptShowCustomerName: e.target.checked };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Nom du Client</span>
              </label>

              {/* Téléphone Client */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.receiptShowCustomerPhone !== false}
                  onChange={(e) => {
                    const updated = { ...settings, receiptShowCustomerPhone: e.target.checked };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Téléphone du Client</span>
              </label>

              {/* Adresse Client */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.receiptShowCustomerAddress !== false}
                  onChange={(e) => {
                    const updated = { ...settings, receiptShowCustomerAddress: e.target.checked };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Adresse du Client</span>
              </label>

              {/* Code-barres */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.receiptShowBarcode !== false}
                  onChange={(e) => {
                    const updated = { ...settings, receiptShowBarcode: e.target.checked };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Code-barres du Bon</span>
              </label>

              {/* Date & Heure */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.receiptShowDate !== false}
                  onChange={(e) => {
                    const updated = { ...settings, receiptShowDate: e.target.checked };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Date et Heure</span>
              </label>

              {/* Nom du Caissier */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.receiptShowCashier !== false}
                  onChange={(e) => {
                    const updated = { ...settings, receiptShowCashier: e.target.checked };
                    setSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Nom du Caissier</span>
              </label>
            </div>
          </div>

          {/* SECTION CONFIGURATION DU LOGO MAGASIN / ATELIER */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <span>Logo de l'Établissement (Haut des Tickets & Bons SAV) :</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showReceiptLogo !== false}
                  onChange={(e) => setSettings({ ...settings, showReceiptLogo: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Imprimer le logo sur les tickets & bons</span>
              </label>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {settings.storeLogo ? (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                    <img
                      src={settings.storeLogo}
                      alt="Logo Magasin"
                      className="max-h-16 max-w-28 object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition cursor-pointer border border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer le logo</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic">
                  Aucun logo configuré. Les tickets s'imprimeront avec l'en-tête texte uniquement.
                </div>
              )}

              <div className="ml-auto">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-2xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{settings.storeLogo ? 'Changer l\'image du logo' : 'Téléverser un logo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* En-tête et coordonnées du magasin */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nom Établissement / Magasin :</label>
              <input
                type="text"
                value={settings.storeName || ''}
                onChange={(e) => {
                  const updated = { ...settings, storeName: e.target.value };
                  setSettings(updated);
                  savePrinterSettings(updated);
                }}
                placeholder="Ex: NOUNOU TELECOM"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:outline-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Activité / Sous-titre :</label>
              <input
                type="text"
                value={settings.storeSubtitle || ''}
                onChange={(e) => {
                  const updated = { ...settings, storeSubtitle: e.target.value };
                  setSettings(updated);
                  savePrinterSettings(updated);
                }}
                placeholder="Ex: VENTE PIECE MOBILE"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:outline-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Ville / Wilaya :</label>
              <input
                type="text"
                value={settings.storeCity || ''}
                onChange={(e) => {
                  const updated = { ...settings, storeCity: e.target.value };
                  setSettings(updated);
                  savePrinterSettings(updated);
                }}
                placeholder="Ex: TIARET"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:outline-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Adresse Complète :</label>
              <input
                type="text"
                value={settings.storeAddress}
                onChange={(e) => setSettings({ ...settings, storeAddress: e.target.value })}
                placeholder="Ex: LAGARE A CÔTÉ DE L'ARRÊT DE BUS LA CITÉ (3)"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Téléphone(s) Magasin & Atelier :</label>
              <input
                type="text"
                value={settings.storePhone}
                onChange={(e) => setSettings({ ...settings, storePhone: e.target.value })}
                placeholder="Ex: 0550793369/0550082685"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 text-xs">Message Pied de Page du Ticket :</label>
            <input
              type="text"
              value={settings.receiptFooter}
              onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
              placeholder="Ex: Merci pour votre confiance ! À bientôt."
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-blue-500"
            />
          </div>
        </div>
        </div>
        )}

        {/* Global Save Button */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Les configurations sont mémorisées et appliquées à chaque impression.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-md cursor-pointer ${
                saveStatus
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25 ring-2 ring-emerald-300'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
              }`}
            >
              {saveStatus ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Save className="w-4 h-4" />}
              <span>{saveStatus ? 'Configuration Enregistrée avec Succès !' : 'Enregistrer la Configuration'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
