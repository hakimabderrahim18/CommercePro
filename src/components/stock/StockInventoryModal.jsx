import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { 
  ClipboardCheck, 
  Printer, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpDown, 
  FileText, 
  RotateCcw, 
  Save, 
  Check, 
  X,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function StockInventoryModal({ isOpen, onClose, onInventoryApplied }) {
  const { t, isRTL } = useLanguage();
  const [products, setProducts] = useState([]);
  const [counts, setCounts] = useState({}); // { [productId]: physicalQuantity }
  const [motifs, setMotifs] = useState({}); // { [productId]: motif }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TOUS');
  const [categories, setCategories] = useState([]);
  const [discrepancyOnly, setDiscrepancyOnly] = useState(false);
  const [printMode, setPrintMode] = useState('RECONCILE'); // 'RECONCILE' or 'BLANK'
  const [notification, setNotification] = useState(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.stock.getAll();
      if (res.success) {
        const prods = res.data || [];
        setProducts(prods);
        setCategories(res.categories || []);

        // Initialiser counts avec la quantité théorique actuelle par défaut
        const initialCounts = {};
        prods.forEach((p) => {
          initialCounts[p._id] = Number(p.quantite) || 0;
        });
        setCounts(initialCounts);
      }
    } catch (err) {
      console.error('Erreur chargement inventaire:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      setSearch('');
      setSelectedCategory('TOUS');
      setDiscrepancyOnly(false);
      setNotification(null);
    }
  }, [isOpen]);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleCountChange = (productId, val) => {
    const num = val === '' ? '' : parseFloat(val);
    setCounts((prev) => ({
      ...prev,
      [productId]: num
    }));
  };

  const handleMotifChange = (productId, val) => {
    setMotifs((prev) => ({
      ...prev,
      [productId]: val
    }));
  };

  const handleResetToSystem = () => {
    const fresh = {};
    products.forEach((p) => {
      fresh[p._id] = Number(p.quantite) || 0;
    });
    setCounts(fresh);
    showToast('Comptages réinitialisés au stock logiciel.');
  };

  const handleClearCounts = () => {
    const empty = {};
    products.forEach((p) => {
      empty[p._id] = '';
    });
    setCounts(empty);
    showToast('Comptages vidés pour saisie à blanc.');
  };

  // Calculations
  const allCalculations = products.map((p) => {
    const stockTheorique = Number(p.quantite) || 0;
    const rawCount = counts[p._id];
    const stockPhysique = rawCount === '' || isNaN(Number(rawCount)) ? stockTheorique : Number(rawCount);
    const ecart = Math.round((stockPhysique - stockTheorique) * 100) / 100;
    const prixAchat = Number(p.prixAchat) || 0;
    const ecartValeur = Math.round((ecart * prixAchat) * 100) / 100;
    return {
      product: p,
      stockTheorique,
      stockPhysique,
      ecart,
      prixAchat,
      ecartValeur,
      hasDiscrepancy: ecart !== 0
    };
  });

  const totalTheorique = allCalculations.reduce((sum, c) => sum + c.stockTheorique, 0);
  const totalPhysique = allCalculations.reduce((sum, c) => sum + c.stockPhysique, 0);
  const totalDiscrepanciesCount = allCalculations.filter((c) => c.hasDiscrepancy).length;
  const totalEcartValeur = allCalculations.reduce((sum, c) => sum + c.ecartValeur, 0);

  // Filtered
  const filteredItems = allCalculations.filter((c) => {
    const p = c.product;
    const matchesSearch = !search.trim() ||
      p.nom.toLowerCase().includes(search.toLowerCase()) ||
      (p.reference && p.reference.toLowerCase().includes(search.toLowerCase())) ||
      (p.codeBarre && p.codeBarre.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = selectedCategory === 'TOUS' || p.categorie === selectedCategory;
    const matchesDiscrepancy = !discrepancyOnly || c.hasDiscrepancy;

    return matchesSearch && matchesCategory && matchesDiscrepancy;
  });

  const handleApplyInventory = async () => {
    const itemsToAdjust = allCalculations
      .filter((c) => c.hasDiscrepancy)
      .map((c) => ({
        productId: c.product._id,
        stockTheorique: c.stockTheorique,
        stockPhysique: c.stockPhysique,
        ecart: c.ecart,
        prixAchat: c.prixAchat,
        motif: motifs[c.product._id] || 'Rapprochement inventaire physique'
      }));

    if (itemsToAdjust.length === 0) {
      alert('Aucun écart détecté entre le stock physique et le stock logiciel. Tout est conforme !');
      return;
    }

    const confirmMsg = `${t('stock_reconcileConfirm')}\n\n${itemsToAdjust.length} articles présentent un écart pour un impact financier net de ${totalEcartValeur.toLocaleString('fr-DZ')} DA.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setSubmitting(true);
      const res = await api.stock.reconcileInventory({
        items: itemsToAdjust,
        motifGeneral: 'Rapprochement Inventaire Général'
      });

      if (res.success) {
        showToast(`Inventaire validé avec succès ! ${res.count} articles ajustés.`);
        if (onInventoryApplied) onInventoryApplied();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        alert(res.error || 'Erreur lors du rapprochement');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggerPrint = (mode) => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('stock_inventoryTitle')}
      maxWidth="max-w-6xl"
    >
      <div className="space-y-4">
        {/* Toast */}
        {notification && (
          <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between no-print ${
            notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            <span>{notification.msg}</span>
            <button onClick={() => setNotification(null)} className="underline cursor-pointer">Fermer</button>
          </div>
        )}

        {/* Top Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Articles Contrôlés</span>
            <span className="text-lg font-black text-slate-800">{products.length} réf.</span>
          </div>

          <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Stock Théorique vs Réel</span>
            <div className="flex items-baseline gap-1.5 text-sm font-black">
              <span className="text-slate-600">{totalTheorique}</span>
              <span className="text-slate-400">➔</span>
              <span className="text-blue-800 text-base">{totalPhysique}</span>
            </div>
          </div>

          <div className={`p-3 rounded-xl border ${
            totalDiscrepanciesCount > 0 ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider block">Écarts Détectés</span>
            <span className="text-lg font-black">{totalDiscrepanciesCount} article(s)</span>
          </div>

          <div className={`p-3 rounded-xl border ${
            totalEcartValeur < 0 ? 'bg-rose-50 border-rose-300 text-rose-800' : totalEcartValeur > 0 ? 'bg-sky-50 border-sky-300 text-sky-800' : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider block">Impact Valeur Écart</span>
            <span className="text-lg font-black">
              {totalEcartValeur > 0 ? `+${totalEcartValeur.toLocaleString('fr-DZ')}` : totalEcartValeur.toLocaleString('fr-DZ')} DA
            </span>
          </div>
        </div>

        {/* Filter and Quick Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 no-print">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search')}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
              />
            </div>

            {/* Category */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
            >
              <option value="TOUS">{t('stock_allCategories')}</option>
              {categories.map((cat, i) => (
                <option key={i} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Discrepancy toggle button */}
            <button
              type="button"
              onClick={() => setDiscrepancyOnly(!discrepancyOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                discrepancyOnly
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{t('stock_filterDiscrepancies')} ({totalDiscrepanciesCount})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetToSystem}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
              title="Copier les quantités logicielles dans les comptages"
            >
              {t('stock_initFromSystem')}
            </button>

            <button
              type="button"
              onClick={handleClearCounts}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-500 bg-white hover:bg-rose-50 hover:text-rose-600 border border-slate-200 rounded-xl transition cursor-pointer"
              title="Effacer tous les comptages pour saisie à blanc"
            >
              {t('stock_clearCounts')}
            </button>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white max-h-[50vh] overflow-y-auto no-print">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2.5">Réf & Code</th>
                <th className="px-4 py-2.5">Désignation</th>
                <th className="px-4 py-2.5">Catégorie</th>
                <th className="px-4 py-2.5 text-right">P.U Achat</th>
                <th className="px-4 py-2.5 text-center bg-blue-50 text-blue-900">{t('stock_theoreticalStock')}</th>
                <th className="px-4 py-2.5 text-center bg-amber-50 text-amber-900 w-32">{t('stock_physicalStock')}</th>
                <th className="px-4 py-2.5 text-center">{t('stock_discrepancy')}</th>
                <th className="px-4 py-2.5 text-right">{t('stock_discrepancyValue')}</th>
                <th className="px-4 py-2.5">Observation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const p = item.product;
                  const currentPhysical = counts[p._id] !== undefined ? counts[p._id] : item.stockTheorique;
                  const isNegative = item.ecart < 0;
                  const isPositive = item.ecart > 0;
                  const isConform = item.ecart === 0;

                  return (
                    <tr key={p._id} className={`hover:bg-slate-50/80 transition ${item.hasDiscrepancy ? 'bg-amber-50/20' : ''}`}>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-700">
                        {p.codeBarre || p.reference}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-slate-900 block">{p.nom}</span>
                        {(p.taille || p.pointure || p.couleur) && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            {[p.taille && `T:${p.taille}`, p.pointure && `P:${p.pointure}`, p.couleur].filter(Boolean).join(' | ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 font-semibold">
                        {p.categorie || 'Général'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-500">
                        {item.prixAchat.toLocaleString('fr-DZ')} DA
                      </td>
                      <td className="px-4 py-2.5 text-center font-black text-blue-900 bg-blue-50/40">
                        {item.stockTheorique} <span className="text-[10px] font-normal">{p.unite}</span>
                      </td>
                      <td className="px-4 py-2 text-center bg-amber-50/40">
                        <input
                          type="number"
                          step="any"
                          value={currentPhysical}
                          onChange={(e) => handleCountChange(p._id, e.target.value)}
                          className="w-24 text-center font-black text-sm px-2 py-1 bg-white border border-amber-300 rounded-lg focus:outline-blue-600 focus:ring-1 focus:ring-blue-600"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center font-black">
                        {isConform && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            0 ({t('stock_conform')})
                          </span>
                        )}
                        {isPositive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                            +{item.ecart}
                          </span>
                        )}
                        {isNegative && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                            {item.ecart}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-black">
                        <span className={isNegative ? 'text-rose-600' : isPositive ? 'text-blue-600' : 'text-slate-400'}>
                          {item.ecartValeur > 0 ? `+${item.ecartValeur.toLocaleString('fr-DZ')}` : item.ecartValeur.toLocaleString('fr-DZ')} DA
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={motifs[p._id] || ''}
                          onChange={(e) => handleMotifChange(p._id, e.target.value)}
                          placeholder="Observation..."
                          className="w-full text-[11px] px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-slate-300 rounded-md focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    {loading ? 'Chargement...' : 'Aucun produit correspondant aux critères.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 no-print">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleTriggerPrint('BLANK')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>{t('stock_printCountSheet')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleTriggerPrint('RECONCILE')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              <span>{t('stock_printReconcileReport')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              {t('cancel')}
            </button>

            <button
              type="button"
              onClick={handleApplyInventory}
              disabled={submitting || totalDiscrepanciesCount === 0}
              className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-black rounded-xl text-white transition shadow-md cursor-pointer ${
                totalDiscrepanciesCount > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{t('stock_applyAdjustments')} ({totalDiscrepanciesCount})</span>
            </button>
          </div>
        </div>

        {/* Printable Section (Feuille de Comptage ou Procès-Verbal de Rapprochement) */}
        <div className="print-area hidden">
          {printMode === 'BLANK' ? (
            /* Feuille de Comptage Vierge pour Relevé Physique en Magasin */
            <div className="p-6 bg-white space-y-6 text-black">
              <div className="text-center border-b-2 border-black pb-4">
                <h1 className="text-xl font-black uppercase tracking-tight">{t('appTitle')}</h1>
                <h2 className="text-base font-bold uppercase tracking-wider mt-1">{t('stock_emptyCountTitle')}</h2>
                <p className="text-xs text-slate-600">{t('stock_emptyCountSubtitle')}</p>
                <div className="flex justify-between items-center text-xs mt-3 pt-2 border-t border-slate-300">
                  <span>Date : <strong>{new Date().toLocaleDateString('fr-DZ')}</strong></span>
                  <span>Agent inventaire : ___________________________</span>
                  <span>Zone / Rayon : ___________________________</span>
                </div>
              </div>

              <table className="w-full text-xs border-collapse border border-black">
                <thead>
                  <tr className="bg-slate-100 border-b border-black">
                    <th className="border border-black px-2 py-1.5 text-left w-28">Code-Barres</th>
                    <th className="border border-black px-2 py-1.5 text-left">Désignation</th>
                    <th className="border border-black px-2 py-1.5 text-left w-24">Catégorie</th>
                    <th className="border border-black px-2 py-1.5 text-center w-14">Unité</th>
                    <th className="border border-black px-2 py-1.5 text-center w-24">Comptage Réel (Physique)</th>
                    <th className="border border-black px-2 py-1.5 text-left w-32">Observations</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, idx) => (
                    <tr key={p._id || idx} className="border-b border-slate-300">
                      <td className="border border-black px-2 py-2 font-mono text-[11px]">{p.codeBarre || p.reference}</td>
                      <td className="border border-black px-2 py-2 font-bold">{p.nom}</td>
                      <td className="border border-black px-2 py-2">{p.categorie || '-'}</td>
                      <td className="border border-black px-2 py-2 text-center">{p.unite || 'pcs'}</td>
                      <td className="border border-black px-2 py-2 text-center"></td>
                      <td className="border border-black px-2 py-2"></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-8 pt-8 text-xs border-t border-black">
                <div>
                  <p className="font-bold">Signature Responsable Inventaire :</p>
                  <div className="h-16 border-b border-dashed border-black mt-2"></div>
                </div>
                <div>
                  <p className="font-bold">Visa Gérant / Direction :</p>
                  <div className="h-16 border-b border-dashed border-black mt-2"></div>
                </div>
              </div>
            </div>
          ) : (
            /* Procès-Verbal de Rapprochement d'Inventaire et Écarts */
            <div className="p-6 bg-white space-y-6 text-black">
              <div className="text-center border-b-2 border-black pb-4">
                <h1 className="text-xl font-black uppercase tracking-tight">{t('appTitle')}</h1>
                <h2 className="text-base font-bold uppercase tracking-wider mt-1">{t('stock_pvTitle')}</h2>
                <p className="text-xs text-slate-600">{t('stock_pvSubtitle')}</p>
                <div className="flex justify-between items-center text-xs mt-3 pt-2 border-t border-slate-300">
                  <span>Date d'inventaire : <strong>{new Date().toLocaleDateString('fr-DZ')}</strong></span>
                  <span>Réf PV : <strong>INV-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}</strong></span>
                  <span>Total Articles : <strong>{products.length}</strong></span>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-4 border border-black p-3 text-xs bg-slate-50">
                <div>
                  <span className="block text-slate-600">Stock Théorique (Logiciel) :</span>
                  <strong className="text-sm">{totalTheorique} unités</strong>
                </div>
                <div>
                  <span className="block text-slate-600">Stock Physique (Constaté) :</span>
                  <strong className="text-sm">{totalPhysique} unités</strong>
                </div>
                <div>
                  <span className="block text-slate-600">Valorisation Nette des Écarts :</span>
                  <strong className="text-sm">{totalEcartValeur.toLocaleString('fr-DZ')} DA</strong>
                </div>
              </div>

              <table className="w-full text-xs border-collapse border border-black">
                <thead>
                  <tr className="bg-slate-100 border-b border-black">
                    <th className="border border-black px-2 py-1.5 text-left">Code / Réf</th>
                    <th className="border border-black px-2 py-1.5 text-left">Désignation</th>
                    <th className="border border-black px-2 py-1.5 text-right w-20">P.U Achat</th>
                    <th className="border border-black px-2 py-1.5 text-center w-16">Théorique</th>
                    <th className="border border-black px-2 py-1.5 text-center w-16">Physique</th>
                    <th className="border border-black px-2 py-1.5 text-center w-16">Écart</th>
                    <th className="border border-black px-2 py-1.5 text-right w-24">Impact (DA)</th>
                  </tr>
                </thead>
                <tbody>
                  {allCalculations.map((item, idx) => (
                    <tr key={item.product._id || idx} className="border-b border-slate-200">
                      <td className="border border-black px-2 py-1 font-mono text-[11px]">{item.product.codeBarre || item.product.reference}</td>
                      <td className="border border-black px-2 py-1 font-bold">{item.product.nom}</td>
                      <td className="border border-black px-2 py-1 text-right">{item.prixAchat.toLocaleString('fr-DZ')} DA</td>
                      <td className="border border-black px-2 py-1 text-center">{item.stockTheorique}</td>
                      <td className="border border-black px-2 py-1 text-center font-bold">{item.stockPhysique}</td>
                      <td className="border border-black px-2 py-1 text-center font-black">
                        {item.ecart > 0 ? `+${item.ecart}` : item.ecart}
                      </td>
                      <td className="border border-black px-2 py-1 text-right font-bold">
                        {item.ecartValeur.toLocaleString('fr-DZ')} DA
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-8 pt-8 text-xs border-t border-black">
                <div>
                  <p className="font-bold">Commission d'Inventaire :</p>
                  <p className="text-[11px] text-slate-500">Nom & Visa des contrôleurs</p>
                  <div className="h-16 border-b border-dashed border-black mt-2"></div>
                </div>
                <div>
                  <p className="font-bold">Approbation Direction :</p>
                  <p className="text-[11px] text-slate-500">Cachet & Signature de validation</p>
                  <div className="h-16 border-b border-dashed border-black mt-2"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
