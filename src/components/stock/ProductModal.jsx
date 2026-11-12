import React, { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { Sparkles, Save, Barcode, CheckCircle, CheckCircle2, Plus, X, Camera, Image as ImageIcon, Trash2, Upload, Truck } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { useLanguage } from '../../context/LanguageContext';
import { generateStandardEan13, getPrinterSettings, getStoreName } from '../../utils/printerHelper';

export default function ProductModal({ isOpen, onClose, product, onSaved, onProductCreated }) {
  const { t, isRTL } = useLanguage();
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    reference: '',
    codeBarre: '',
    codesBarres: [],
    image: '',
    nom: '',
    categorie: isRTL ? 'عام' : 'Général',
    marque: '',
    modele: '',
    compatibilite: '',
    datePeremption: '',
    taille: '',
    pointure: '',
    couleur: '',
    genre: 'UNISEXE',
    prixAchat: '',
    prixVente: '',
    prixDemiGros: '',
    prixGros: '',
    prixSuperGros: '',
    prixSerie: '',
    piecesParSerie: 1,
    quantite: 10,
    seuilAlerte: 5,
    unite: 'pcs',
    fournisseur: ''
  });

  const [appSettings, setAppSettings] = useState(getPrinterSettings());
  const [saveSuccess, setSaveSuccess] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setAppSettings(getPrinterSettings());
    }
  }, [isOpen]);

  useEffect(() => {
    const handleSettingsChanged = (e) => {
      setAppSettings(e?.detail || getPrinterSettings());
    };
    window.addEventListener('printer-settings-changed', handleSettingsChanged);
    return () => window.removeEventListener('printer-settings-changed', handleSettingsChanged);
  }, []);

  const activityType = appSettings.activityType || 'pieces_detachees';
  const enableSeriePricing = appSettings.enableSeriePricing !== false;

  const barcodeSvgRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);

  // Fetch available categories and suppliers for suggestions
  useEffect(() => {
    if (isOpen) {
      if (api.supplier?.getAll) {
        api.supplier.getAll().then((res) => {
          if (res?.success && Array.isArray(res.data)) {
            const list = res.data.map((s) => ({
              id: s.id || s._id,
              nom: s.nom || s.name || '',
              telephone: s.telephone || '',
              soldeDette: Number(s.soldeDette || 0)
            })).filter(s => s.nom);
            setSuppliersList((prev) => {
              const combined = [...list];
              prev.forEach(p => {
                if (!combined.some(c => c.nom.toLowerCase() === p.nom.toLowerCase())) {
                  combined.push(p);
                }
              });
              return combined;
            });
            setAvailableSuppliers(list.map(s => s.nom));
          }
        }).catch(() => {});
      }
      if (api.stock?.getAll) {
        api.stock.getAll().then((res) => {
          if (res?.success && Array.isArray(res.data)) {
            const cats = Array.from(new Set(res.data.map((p) => p.categorie).filter(Boolean)));
            const sups = Array.from(new Set(res.data.map((p) => p.fournisseur).filter(Boolean)));
            setAvailableCategories(cats);
            setSuppliersList((prev) => {
              const combined = [...prev];
              sups.forEach(name => {
                if (!combined.some(c => c.nom.toLowerCase() === name.toLowerCase())) {
                  combined.push({ nom: name, telephone: '', soldeDette: 0 });
                }
              });
              return combined;
            });
            setAvailableSuppliers((prev) => Array.from(new Set([...prev, ...sups])));
          }
        }).catch(() => {});
      }
    }
  }, [isOpen]);

  // Generate live Barcode whenever reference or codeBarre changes
  useEffect(() => {
    if (barcodeSvgRef.current) {
      try {
        const code = (formData.codeBarre || formData.reference || 'ART-0000').trim().toUpperCase();
        const isEAN13 = /^\d{12,13}$/.test(code);
        JsBarcode(barcodeSvgRef.current, code, {
          format: isEAN13 ? 'EAN13' : 'CODE128',
          width: 1.6,
          height: 40,
          displayValue: true,
          fontSize: 12,
          font: 'monospace',
          margin: 4,
          background: '#ffffff'
        });
      } catch (e) {
        try {
          JsBarcode(barcodeSvgRef.current, (formData.reference || 'ART-0000').trim().toUpperCase(), {
            format: 'CODE128',
            width: 1.6,
            height: 40,
            displayValue: true,
            fontSize: 12,
            font: 'monospace',
            margin: 4
          });
        } catch (err) {}
      }
    }
  }, [formData.reference, formData.codeBarre]);

  useEffect(() => {
    if (product) {
      let initialCodes = [];
      if (Array.isArray(product.codesBarres)) {
        initialCodes = product.codesBarres.map(c => String(c).trim()).filter(Boolean);
      } else if (product.codesBarres) {
        try {
          const parsed = JSON.parse(product.codesBarres);
          initialCodes = Array.isArray(parsed) ? parsed : String(product.codesBarres).split(/[,;\s\n]+/);
        } catch (e) {
          initialCodes = String(product.codesBarres).split(/[,;\s\n]+/);
        }
      }
      initialCodes = initialCodes.map(c => String(c).trim()).filter(Boolean);

      setFormData({
        reference: product.reference || '',
        codeBarre: product.codeBarre || product.reference || '',
        codesBarres: initialCodes,
        image: product.image || '',
        nom: product.nom || '',
        categorie: product.categorie || 'Général',
        marque: product.marque || '',
        modele: product.modele || '',
        compatibilite: product.compatibilite || '',
        datePeremption: product.datePeremption || '',
        taille: product.taille || '',
        pointure: product.pointure || '',
        couleur: product.couleur || '',
        genre: product.genre || 'UNISEXE',
        prixAchat: product.prixAchat !== undefined && product.prixAchat !== null ? product.prixAchat : '',
        prixVente: product.prixVente !== undefined && product.prixVente !== null ? product.prixVente : '',
        prixDemiGros: product.prixDemiGros !== undefined && product.prixDemiGros !== null ? product.prixDemiGros : '',
        prixGros: product.prixGros !== undefined && product.prixGros !== null ? product.prixGros : '',
        prixSuperGros: product.prixSuperGros !== undefined && product.prixSuperGros !== null ? product.prixSuperGros : '',
        prixSerie: product.prixSerie !== undefined && product.prixSerie !== null ? product.prixSerie : '',
        piecesParSerie: product.piecesParSerie !== undefined && product.piecesParSerie !== null ? product.piecesParSerie : 1,
        quantite: product.quantite !== undefined && product.quantite !== null ? product.quantite : 10,
        seuilAlerte: product.seuilAlerte ?? 5,
        unite: product.unite || 'pcs',
        fournisseur: product.fournisseur || ''
      });
    } else {
      const defaultCode = Math.floor(1000 + Math.random() * 9000).toString();
      setFormData({
        reference: defaultCode,
        codeBarre: defaultCode,
        codesBarres: [],
        image: '',
        nom: '',
        categorie: 'Général',
        marque: '',
        modele: '',
        compatibilite: '',
        datePeremption: '',
        taille: '',
        pointure: '',
        couleur: '',
        genre: 'UNISEXE',
        prixAchat: '',
        prixVente: '',
        prixDemiGros: '',
        prixGros: '',
        prixSuperGros: '',
        prixSerie: '',
        piecesParSerie: 1,
        quantite: 10,
        seuilAlerte: 5,
        unite: 'pcs',
        fournisseur: ''
      });
    }
    setNewBarcode('');
    setError('');
    setSaveSuccess(null);
  }, [product, isOpen]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('La photo sélectionnée est trop volumineuse (max 10 Mo).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round(height * (MAX_WIDTH / width));
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round(width * (MAX_HEIGHT / height));
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setFormData((prev) => ({ ...prev, image: compressedDataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, image: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleNumericInput = (field, val) => {
    const clean = String(val).replace(/^0+(?=\d)/, '');
    setFormData((prev) => ({ ...prev, [field]: clean }));
  };

  const generateNewShortCode = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData((prev) => ({ ...prev, reference: code, codeBarre: code }));
  };

  const generateNewRef = () => {
    const newRef = `ART-${Date.now().toString().slice(-6)}`;
    setFormData((prev) => ({ ...prev, reference: newRef, codeBarre: newRef }));
  };

  const generateNewEan13 = () => {
    const ean = generateStandardEan13();
    setFormData((prev) => ({ ...prev, reference: ean, codeBarre: ean }));
  };

  const handleAddSecondaryBarcode = (e) => {
    if (e) e.preventDefault();
    const codeToAdd = newBarcode.trim().toUpperCase();
    if (!codeToAdd) return;
    if (codeToAdd === (formData.codeBarre || '').trim().toUpperCase() || codeToAdd === (formData.reference || '').trim().toUpperCase()) {
      setError("Ce code correspond déjà au code-barres principal ou à la référence.");
      return;
    }
    if (formData.codesBarres.includes(codeToAdd)) {
      setError("Ce code-barres supplémentaire est déjà présent dans la liste.");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      codesBarres: [...prev.codesBarres, codeToAdd]
    }));
    setNewBarcode('');
    setError('');
  };

  const handleRemoveSecondaryBarcode = (codeToRemove) => {
    setFormData((prev) => ({
      ...prev,
      codesBarres: prev.codesBarres.filter((c) => c !== codeToRemove)
    }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.reference.trim()) {
      setError('La référence du produit est obligatoire.');
      return;
    }
    if (!formData.nom.trim()) {
      setError('Le nom du produit est obligatoire.');
      return;
    }
    if (Number(formData.prixVente) <= 0) {
      setError('Le prix de vente doit être supérieur à 0.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        ...formData,
        prixAchat: parseFloat(formData.prixAchat) || 0,
        prixVente: parseFloat(formData.prixVente) || 0,
        prixDemiGros: parseFloat(formData.prixDemiGros) || 0,
        prixGros: parseFloat(formData.prixGros) || 0,
        prixSuperGros: parseFloat(formData.prixSuperGros) || 0,
        prixSerie: parseFloat(formData.prixSerie) || 0,
        piecesParSerie: Math.max(1, parseFloat(formData.piecesParSerie) || 1),
        quantite: parseFloat(formData.quantite) || 0,
        seuilAlerte: parseFloat(formData.seuilAlerte) || 0,
      };

      let res;
      if (product) {
        res = await api.stock.update(product._id, payload);
      } else {
        res = await api.stock.create(payload);
      }

      if (res.success) {
        setSaveSuccess(product ? 'Produit mis à jour avec succès !' : 'Produit enregistré avec succès et code-barres généré !');
        setTimeout(() => {
          if (onSaved) onSaved(res.product || res.data || payload);
          if (onProductCreated) onProductCreated(res.product || res.data || payload);
          onClose();
          setSaveSuccess(null);
        }, 900);
      } else {
        setError(res.error || 'Erreur lors de l’enregistrement du produit.');
      }
    } catch (err) {
      setError(err.message || 'Erreur de connexion à la base de données.');
    } finally {
      setLoading(false);
    }
  };

  // Calcul marge unitaire
  const marge = Number(formData.prixVente) - Number(formData.prixAchat);
  const tauxMarge = Number(formData.prixAchat) > 0 ? Math.round((marge / Number(formData.prixAchat)) * 100) : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <span>{product ? `${t('prodModal_editTitle')} ${product.nom}` : t('prodModal_addTitle')}</span>
          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
            {activityType === 'pieces_detachees' ? '🔧 Pièces Détachées & Atelier' :
             activityType === 'vetements' ? '👕 Vêtements & Mode' :
             activityType === 'alimentation' ? '🥫 Alimentation Générale' : '📦 Commerce Général'}
          </span>
        </div>
      }
      maxWidth="max-w-4xl"
    >
      <form 
        onSubmit={handleSubmit} 
        onKeyDown={(e) => {
          // Empêcher la touche Entrée de soumettre et fermer brutalement le formulaire lors de la saisie ou d'un scan à la douchette
          if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
            e.preventDefault();
          }
        }}
        className="space-y-4"
      >
        {saveSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LEFT 2 COLS: PRODUCT FORM */}
          <div className="md:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Référence / Code */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">{t('prodModal_ref')}</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={generateNewEan13}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      title="Générer automatiquement un code-barres standard EAN-13 (13 chiffres avec clé GS1)"
                    >
                      <Barcode className="w-3.5 h-3.5 text-emerald-600" />
                      <span>⚡ Auto EAN-13</span>
                    </button>
                    {!product && (
                      <>
                        <button
                          type="button"
                          onClick={generateNewShortCode}
                          className="text-[11px] text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition"
                          title="Générer un code 4 chiffres (ex: 6814)"
                        >
                          <Sparkles className="w-3 h-3" /> 🔢 4 Chiffres
                        </button>
                        <button
                          type="button"
                          onClick={generateNewRef}
                          className="text-[11px] text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-1.5 py-0.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition"
                          title="Générer une référence ART-XXXX"
                        >
                          🏷️ ART-XXXX
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value.toUpperCase(), codeBarre: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold font-mono focus:bg-white focus:outline-blue-500"
                  placeholder="EX: 6814 ou ART-00123"
                />
              </div>

              {/* Catégorie */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('stock_category')}</label>
                <input
                  type="text"
                  list="product-categories-suggestions"
                  value={formData.categorie}
                  onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
                  placeholder={t('prodModal_categoryPlaceholder')}
                />
                <datalist id="product-categories-suggestions">
                  {availableCategories.map((c, idx) => (
                    <option key={idx} value={c} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Nom du Produit */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('prodModal_designation')}</label>
              <input
                type="text"
                required
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
                placeholder={t('prodModal_namePlaceholder')}
              />
            </div>

            {/* Codes-Barres Additionnels (Multi-codes) */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Barcode className="w-4 h-4 text-blue-600" /> Codes-Barres Additionnels (Multi-codes)
                </label>
                <span className="text-[10px] text-slate-500 font-semibold">
                  {formData.codesBarres?.length || 0} code{(formData.codesBarres?.length || 0) > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Associez d'autres codes-barres (cartons, packs, variantes de fournisseurs) à cet article. Chaque code est reconnu instantanément au scan.
              </p>
              
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSecondaryBarcode();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold focus:outline-blue-500"
                  placeholder="Scanner avec douchette ou saisir un code..."
                />
                <button
                  type="button"
                  onClick={handleAddSecondaryBarcode}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter
                </button>
              </div>

              {formData.codesBarres && formData.codesBarres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {formData.codesBarres.map((cb, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-blue-200 rounded-lg text-xs font-mono font-bold text-slate-700 shadow-2xs"
                    >
                      <Barcode className="w-3 h-3 text-blue-600" />
                      <span>{cb}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSecondaryBarcode(cb)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer font-black text-xs ml-0.5"
                        title="Supprimer ce code"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Tarification Multi-prix (Détail, Demi-gros, Gros, Super gros) */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  💰 {t('prodModal_purchasePrice')} & Barème Multi-Prix
                </label>
                <span className="text-[10px] text-slate-500 font-semibold">(Tarifs de vente)</span>
              </div>

              {/* Prix d'Achat */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">{t('prodModal_purchasePrice')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={formData.prixAchat ?? ''}
                  onChange={(e) => handleNumericInput('prixAchat', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-blue-500"
                  placeholder="0.000"
                />
              </div>

              {/* Grille des 4 Prix de Vente */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1. Prix Détail */}
                <div className="bg-white p-2.5 rounded-xl border border-blue-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold text-blue-700">{t('tariff_detail')} *</span>
                    <span className="text-[9px] font-bold px-1 rounded bg-blue-50 text-blue-600">Standard</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    required
                    value={formData.prixVente ?? ''}
                    onChange={(e) => handleNumericInput('prixVente', e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-blue-600 focus:bg-white focus:outline-blue-500"
                    placeholder="0.000"
                  />
                  <div className="mt-1 text-[9px] font-bold text-slate-500 text-right">
                    Marge: {(Number(formData.prixVente || 0) - Number(formData.prixAchat || 0)).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA
                  </div>
                </div>

                {/* 2. Prix Demi-Gros */}
                <div className="bg-white p-2.5 rounded-xl border border-indigo-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold text-indigo-700">{t('tariff_semiWholesale')}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={formData.prixDemiGros ?? ''}
                    onChange={(e) => handleNumericInput('prixDemiGros', e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-indigo-600 focus:bg-white focus:outline-indigo-500"
                    placeholder="0.000"
                  />
                  <div className="mt-1 text-[9px] font-bold text-slate-500 text-right">
                    Marge: {(Number(formData.prixDemiGros || formData.prixVente || 0) - Number(formData.prixAchat || 0)).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA
                  </div>
                </div>

                {/* 3. Prix Gros */}
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold text-emerald-700">{t('tariff_wholesale')}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={formData.prixGros ?? ''}
                    onChange={(e) => handleNumericInput('prixGros', e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-emerald-600 focus:bg-white focus:outline-emerald-500"
                    placeholder="0.000"
                  />
                  <div className="mt-1 text-[9px] font-bold text-slate-500 text-right">
                    Marge: {(Number(formData.prixGros || formData.prixVente || 0) - Number(formData.prixAchat || 0)).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA
                  </div>
                </div>

                {/* 4. Prix Super Gros */}
                <div className="bg-white p-2.5 rounded-xl border border-purple-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold text-purple-700">{t('tariff_superWholesale')}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={formData.prixSuperGros ?? ''}
                    onChange={(e) => handleNumericInput('prixSuperGros', e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-purple-600 focus:bg-white focus:outline-purple-500"
                    placeholder="0.000"
                  />
                  <div className="mt-1 text-[9px] font-bold text-slate-500 text-right">
                    Marge: {(Number(formData.prixSuperGros || formData.prixVente || 0) - Number(formData.prixAchat || 0)).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA
                  </div>
                </div>
              </div>

              {/* 5. Tarif Vente en Série (Prix de la Série & Nombre de Pièces) */}
              {enableSeriePricing && (
                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      📦 {t('price_serie')} & Conditionnement en Série
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      Vente par lot / série
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold text-amber-900 mb-1">
                        {t('price_serie')} (DA)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={formData.prixSerie ?? ''}
                        onChange={(e) => handleNumericInput('prixSerie', e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-black text-amber-900 focus:outline-amber-500 shadow-2xs"
                        placeholder="0.000"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-amber-900 mb-1">
                        {t('pieces_per_serie')} (Nombre de pièces)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={formData.piecesParSerie ?? 1}
                        onChange={(e) => handleNumericInput('piecesParSerie', e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-black text-amber-900 focus:outline-amber-500 shadow-2xs"
                        placeholder="1"
                      />
                    </div>
                  </div>
                  {Number(formData.prixSerie) > 0 && Number(formData.piecesParSerie) > 0 && (
                    <div className="text-[10px] font-bold text-amber-800 flex justify-between items-center pt-1 border-t border-amber-200">
                      <span>
                        Revient à : {(Number(formData.prixSerie) / Number(formData.piecesParSerie)).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA / pièce
                      </span>
                      <span>
                        Marge série : {(Number(formData.prixSerie) - (Number(formData.prixAchat || 0) * Number(formData.piecesParSerie))).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Alerte si le prix détail est inférieur au prix d'achat */}
              {Number(formData.prixVente) > 0 && Number(formData.prixAchat) > 0 && Number(formData.prixVente) < Number(formData.prixAchat) && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-1.5">
                  <span>⚠️ {t('alert_belowCostTitle')}</span>
                </div>
              )}
            </div>

            {/* Quantité, Unité & Seuil alerte */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('prodModal_initQty')}</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.quantite ?? ''}
                  onChange={(e) => handleNumericInput('quantite', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('prodModal_unit')}</label>
                <select
                  value={formData.unite}
                  onChange={(e) => setFormData({ ...formData, unite: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
                >
                  <option value="pcs">{t('unit_pcs')}</option>
                  <option value="kg">{t('unit_kg')}</option>
                  <option value="g">{t('unit_g')}</option>
                  <option value="litre">{t('unit_l')}</option>
                  <option value="carton">{t('unit_carton')}</option>
                  <option value="paquet">{t('unit_pack')}</option>
                  <option value="metre">{t('unit_meter')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('prodModal_alertThreshold')}</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.seuilAlerte ?? ''}
                  onChange={(e) => handleNumericInput('seuilAlerte', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
                />
              </div>
            </div>

            {/* Dynamic Section based on activityType */}
            {activityType === 'pieces_detachees' && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    🔧 📱 Spécifications Pièce Détachée & Compatibilité
                  </span>
                  <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                    Activité Atelier & IT
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Marque Constructeur</label>
                    <input
                      type="text"
                      value={formData.marque || ''}
                      onChange={(e) => setFormData({ ...formData, marque: e.target.value.toUpperCase() })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-blue-500"
                      placeholder="Ex: SAMSUNG, APPLE, XIAOMI, OPPO..."
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Modèle / Série</label>
                    <input
                      type="text"
                      value={formData.modele || ''}
                      onChange={(e) => setFormData({ ...formData, modele: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-blue-500"
                      placeholder="Ex: GALAXY A13, REDMI 9, IPHONE 11..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Modèles & Références Compatibles</label>
                  <input
                    type="text"
                    value={formData.compatibilite || ''}
                    onChange={(e) => setFormData({ ...formData, compatibilite: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
                    placeholder="Ex: Compatible Samsung A13 4G / M13 / F13 (A135F, A137F)"
                  />
                </div>
              </div>
            )}

            {activityType === 'alimentation' && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    🥫 📦 Alimentation, DLUO & Traçabilité
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Activité Alimentation
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Date Limite de Consommation (DLC / DLUO)</label>
                    <input
                      type="date"
                      value={formData.datePeremption || ''}
                      onChange={(e) => setFormData({ ...formData, datePeremption: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Marque / Producteur</label>
                    <input
                      type="text"
                      value={formData.marque || ''}
                      onChange={(e) => setFormData({ ...formData, marque: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-emerald-500"
                      placeholder="Ex: Candia, Danone, Cevital, Soummam..."
                    />
                  </div>
                </div>
              </div>
            )}

            {(activityType === 'vetements' || activityType === 'general') && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    👕 👟 {t('prod_type')} & Variantes
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {activityType === 'vetements' ? 'Mode Prêt-à-porter' : '(Optionnel)'}
                  </span>
                </div>

                {/* Genre / Public */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">{t('prod_gender')}</label>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { id: 'UNISEXE', label: t('prod_genderUnisex') },
                      { id: 'HOMME', label: t('prod_genderMen') },
                      { id: 'FEMME', label: t('prod_genderWomen') },
                      { id: 'ENFANT', label: t('prod_genderKids') },
                      { id: 'BEBE', label: t('prod_genderBaby') }
                    ].map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, genre: g.id })}
                        className={`px-1.5 py-1 text-[10px] font-bold rounded-lg border transition cursor-pointer text-center ${
                          formData.genre === g.id
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Taille (Size) & Pointure (Shoe Size) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">{t('prod_size')}</label>
                    <input
                      type="text"
                      value={formData.taille}
                      onChange={(e) => setFormData({ ...formData, taille: e.target.value.toUpperCase() })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-blue-500 mb-1"
                      placeholder="Ex: S, M, L, XL..."
                    />
                    <div className="flex flex-wrap gap-1">
                      {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData({ ...formData, taille: s })}
                          className={`px-1.5 py-0.5 text-[9px] font-black rounded border cursor-pointer ${
                            formData.taille === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">{t('prod_shoeSize')}</label>
                    <input
                      type="text"
                      value={formData.pointure}
                      onChange={(e) => setFormData({ ...formData, pointure: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-blue-500 mb-1"
                      placeholder="Ex: 38, 40, 42..."
                    />
                    <div className="flex flex-wrap gap-1">
                      {['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFormData({ ...formData, pointure: p })}
                          className={`px-1.5 py-0.5 text-[9px] font-black rounded border cursor-pointer ${
                            formData.pointure === p ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Couleur */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">{t('prod_color')}</label>
                  <input
                    type="text"
                    value={formData.couleur}
                    onChange={(e) => setFormData({ ...formData, couleur: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500 mb-1.5"
                    placeholder="Ex: Noir, Blanc, Bleu marine, Rouge..."
                  />
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {[
                      { name: 'Noir', color: '#000000' },
                      { name: 'Blanc', color: '#ffffff' },
                      { name: 'Bleu', color: '#2563eb' },
                      { name: 'Rouge', color: '#dc2626' },
                      { name: 'Vert', color: '#16a34a' },
                      { name: 'Gris', color: '#64748b' },
                      { name: 'Marron', color: '#78350f' },
                      { name: 'Beige', color: '#d4b996' },
                      { name: 'Jaune', color: '#eab308' },
                      { name: 'Rose', color: '#ec4899' }
                    ].map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, couleur: c.name })}
                        title={c.name}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold transition cursor-pointer ${
                          formData.couleur === c.name ? 'ring-2 ring-blue-600 font-bold bg-blue-50 border-blue-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full border border-slate-300" style={{ backgroundColor: c.color }} />
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Fournisseur (Saisie libre & Suggestions) */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('prodModal_supplier') || 'Fournisseur'}</span>
                </label>
                <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Saisie libre & Suggestions
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={formData.fournisseur}
                  onChange={(e) => {
                    setFormData({ ...formData, fournisseur: e.target.value });
                    setShowSupplierSuggestions(true);
                  }}
                  onFocus={() => setShowSupplierSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 250)}
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-blue-500"
                  placeholder={t('prodModal_supplierPlaceholder') || 'Tapez le nom du fournisseur...'}
                />
                {formData.fournisseur && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, fournisseur: '' });
                      setShowSupplierSuggestions(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full transition"
                    title="Effacer le fournisseur"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showSupplierSuggestions && (
                <div className="absolute z-40 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                  {(() => {
                    const query = (formData.fournisseur || '').trim().toLowerCase();
                    const filtered = suppliersList.filter(s =>
                      !query ||
                      (s.nom && s.nom.toLowerCase().includes(query)) ||
                      (s.telephone && s.telephone.includes(query))
                    );

                    if (filtered.length === 0 && formData.fournisseur && formData.fournisseur.trim().length > 0) {
                      return (
                        <div
                          onMouseDown={() => {
                            setShowSupplierSuggestions(false);
                          }}
                          className="p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between text-xs text-slate-600 transition"
                        >
                          <div className="flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Utiliser le fournisseur libre : <b className="text-emerald-700 font-bold">"{formData.fournisseur}"</b></span>
                          </div>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Nouveau</span>
                        </div>
                      );
                    }

                    if (filtered.length === 0) {
                      return (
                        <div className="p-3 text-xs text-slate-400 text-center italic">
                          Aucun fournisseur enregistré. Saisissez librement un nom ci-dessus.
                        </div>
                      );
                    }

                    return filtered.slice(0, 10).map((s, idx) => (
                      <div
                        key={s.id || idx}
                        onMouseDown={() => {
                          setFormData({ ...formData, fournisseur: s.nom });
                          setShowSupplierSuggestions(false);
                        }}
                        className="p-2 hover:bg-blue-50/80 cursor-pointer flex items-center justify-between text-xs transition group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center text-slate-600 group-hover:text-blue-600 transition">
                            <Truck className="w-3 h-3" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 group-hover:text-blue-700">{s.nom}</span>
                            {s.telephone ? (
                              <span className="text-[10px] text-slate-400 block font-mono">Tél: {s.telephone}</span>
                            ) : null}
                          </div>
                        </div>
                        {s.soldeDette > 0 ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Dette: {Number(s.soldeDette).toLocaleString('fr-DZ')} DA
                          </span>
                        ) : null}
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT 1 COL: PHOTO & BARCODE PREVIEW */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
            <div>
              {/* Product Photo Upload Card */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-600" /> Photo du Produit
                  </span>
                  {formData.image && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                      Attachée
                    </span>
                  )}
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />

                {formData.image ? (
                  <div className="relative group bg-white border-2 border-emerald-200 rounded-2xl p-2 flex flex-col items-center shadow-xs">
                    <img
                      src={formData.image}
                      alt="Produit"
                      className="w-full h-32 object-contain rounded-xl bg-slate-50"
                    />
                    <div className="flex items-center gap-2 mt-2 w-full">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-1.5 text-xs font-bold text-slate-700 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" /> Changer
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-xl transition flex items-center justify-center cursor-pointer"
                        title="Supprimer la photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition group"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center text-slate-500 group-hover:text-emerald-600 transition mb-1.5">
                      <Camera className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">
                      Ajouter une photo
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Sélection visuelle dans le POS (JPG/PNG)
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Barcode className="w-4 h-4 text-blue-600" /> {t('prodModal_barcodePreview')}
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md">Live</span>
              </div>

              {/* Horizontal Barcode Label Card (Reflet Exact de la Photo Utilisateur) */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-300 shadow-2xs flex flex-col items-center text-center space-y-1.5 w-full">
                {/* 1. Grand Nom du Magasin */}
                <div className="font-black text-[13px] uppercase tracking-wider text-slate-900 leading-tight">
                  {getStoreName(appSettings)}
                </div>

                {/* 2. Nom du Produit */}
                <h4 className="text-[11px] font-extrabold text-slate-800 leading-tight truncate w-full uppercase">
                  {formData.nom || (isRTL ? 'اسم المنتج' : 'TEST')}
                </h4>

                {/* Variantes Preview Badges */}
                {(formData.taille || formData.pointure || formData.couleur || (formData.genre && formData.genre !== 'UNISEXE')) && (
                  <div className="flex flex-wrap justify-center gap-1">
                    {formData.taille && (
                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[9px] rounded">
                        Taille: {formData.taille}
                      </span>
                    )}
                    {formData.pointure && (
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[9px] rounded">
                        Pointure: {formData.pointure}
                      </span>
                    )}
                    {formData.couleur && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[9px] rounded">
                        {formData.couleur}
                      </span>
                    )}
                  </div>
                )}

                {/* 3. 1D Barcode Graphic */}
                <div className="w-full bg-white p-0.5 rounded-lg flex items-center justify-center overflow-hidden">
                  <svg ref={barcodeSvgRef} className="w-full max-h-14"></svg>
                </div>

                {/* 4. Numéro / Référence centré */}
                <div className="text-center font-mono font-black text-slate-900 text-xs tracking-wider">
                  {formData.reference || '6814'}
                </div>

                {/* 5. Grand Prix en DA */}
                <div className="pt-1 border-t border-slate-100 w-full text-center">
                  <span className="text-xs font-black italic text-slate-900">
                    Prix: <span className="text-base font-black text-black">{Number(formData.prixVente || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span> DA
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full mt-4 pt-3 border-t border-slate-200 text-left space-y-1 text-[11px] text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Type :</span>
                <span className="font-mono font-bold text-slate-700">Code-Barres 1D (Code 128)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('stock_category')} :</span>
                <span className="font-semibold text-slate-700">{formData.categorie || (isRTL ? 'عام' : 'Général')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('prodModal_unit')} :</span>
                <span className="font-semibold text-slate-700">{formData.unite}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Enregistrement...' : 'Enregistrer & Générer le Code-Barres'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
