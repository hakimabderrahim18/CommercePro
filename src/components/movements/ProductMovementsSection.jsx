import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Package, 
  Calendar, 
  ArrowLeftRight, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Truck, 
  RotateCcw, 
  Sliders, 
  Printer, 
  FileSpreadsheet, 
  Check, 
  X, 
  Barcode, 
  AlertTriangle, 
  PlusCircle, 
  Wrench, 
  DollarSign, 
  Tag, 
  RefreshCw,
  TrendingUp,
  Clock,
  Layers,
  ChevronRight
} from 'lucide-react';
import { api } from '../../services/api';
import StockMovementModal from '../stock/StockMovementModal';
import { printHtmlContent, getPrinterSettings, generateProductMovementHtml } from '../../utils/printerHelper';

export default function ProductMovementsSection({ initialProductId = null, onSelectProductGlobal = null }) {
  // Liste des produits en stock pour l'autocomplete
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Produit sélectionné
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Filtres
  const [period, setPeriod] = useState('month'); // 'today' | 'week' | 'month' | 'year' | 'all' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedType, setSelectedType] = useState('TOUS');

  // Mouvements et état
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Modal d'ajustement manuel rapide
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Impression
  const [printFormat, setPrintFormat] = useState('a4'); // 'a4' | '80mm'

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Charger la liste des produits
  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await api.stock.getAll();
      if (res && res.success) {
        const prods = res.data || [];
        setProducts(prods);

        // Si initialProductId est fourni
        if (initialProductId) {
          const found = prods.find(p => String(p._id || p.id) === String(initialProductId));
          if (found) {
            setSelectedProduct(found);
            setProductSearchTerm(found.nom || '');
          }
        }
      }
    } catch (e) {
      console.error('Erreur chargement produits:', e);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [initialProductId]);

  // Charger les mouvements du produit sélectionné (ou de tous si aucun sélectionné)
  const loadMovements = async () => {
    try {
      setLoadingMovements(true);

      const params = {
        type: selectedType !== 'TOUS' ? selectedType : undefined,
        limit: 1000
      };

      if (selectedProduct) {
        params.productId = selectedProduct.id || selectedProduct._id;
      }

      if (period === 'custom') {
        params.startDate = startDate || undefined;
        params.endDate = endDate || undefined;
      } else {
        params.period = period;
      }

      const res = await api.stock.getMovements(params);
      if (res && res.success) {
        setMovements(res.data || []);
      } else {
        setMovements([]);
      }
    } catch (e) {
      console.error('Erreur chargement mouvements:', e);
      setMovements([]);
    } finally {
      setLoadingMovements(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [selectedProduct, period, startDate, endDate, selectedType]);

  // Clic extérieur pour fermer l'autocomplete
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsAutocompleteOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrage libre avec suggestion
  const term = productSearchTerm.trim().toLowerCase();
  const filteredSuggestions = products.filter(p => {
    if (!term) return true;
    const nameMatch = (p.nom || '').toLowerCase().includes(term);
    const refMatch = (p.reference || '').toLowerCase().includes(term);
    const barcodeMatch = (p.codeBarre || '').toLowerCase().includes(term);
    const catMatch = (p.categorie || '').toLowerCase().includes(term);
    return nameMatch || refMatch || barcodeMatch || catMatch;
  }).slice(0, 30);

  const handleSelectProduct = (prod) => {
    if (!prod) {
      setSelectedProduct(null);
      setProductSearchTerm('');
    } else {
      setSelectedProduct(prod);
      setProductSearchTerm(prod.nom || '');
      if (onSelectProductGlobal) onSelectProductGlobal(prod);
    }
    setIsAutocompleteOpen(false);
  };

  const handleClearSelection = () => {
    setSelectedProduct(null);
    setProductSearchTerm('');
    if (inputRef.current) inputRef.current.focus();
    setIsAutocompleteOpen(true);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setProductSearchTerm(val);
    setIsAutocompleteOpen(true);
    setHighlightedIndex(0);

    // Détection scan douchette instantané
    const exactMatch = products.find(
      p => (p.codeBarre && p.codeBarre === val.trim()) ||
           (p.reference && p.reference.toLowerCase() === val.trim().toLowerCase())
    );
    if (exactMatch) {
      handleSelectProduct(exactMatch);
    } else if (selectedProduct && val !== selectedProduct.nom) {
      setSelectedProduct(null);
    }
  };

  const handleKeyDown = (e) => {
    if (!isAutocompleteOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsAutocompleteOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => prev < filteredSuggestions.length - 1 ? prev + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : filteredSuggestions.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isAutocompleteOpen && filteredSuggestions[highlightedIndex]) {
        handleSelectProduct(filteredSuggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsAutocompleteOpen(false);
    }
  };

  // Calculs statistiques / KPIs sur les mouvements filtrés
  const totalEntries = movements
    .filter(m => Number(m.quantite || 0) > 0)
    .reduce((sum, m) => sum + Number(m.quantite), 0);

  const totalExits = movements
    .filter(m => Number(m.quantite || 0) < 0)
    .reduce((sum, m) => sum + Math.abs(Number(m.quantite)), 0);

  const netVariation = Math.round((totalEntries - totalExits) * 100) / 100;

  // Calcul du stock initial sur la période
  // Si on a des mouvements ordonnés par date décroissante, le plus ancien est à la fin
  let initialStock = null;
  if (selectedProduct && movements.length > 0) {
    const oldestMvt = movements[movements.length - 1];
    initialStock = oldestMvt.quantiteAvant !== undefined ? Number(oldestMvt.quantiteAvant) : null;
  } else if (selectedProduct) {
    initialStock = Number(selectedProduct.quantite || 0);
  }

  // Ventes du produit sur la période
  const salesMovements = movements.filter(m => m.type === 'VENTE');
  const totalVentesQty = salesMovements.reduce((sum, m) => sum + Math.abs(Number(m.quantite)), 0);
  const totalVentesCA = salesMovements.reduce((sum, m) => {
    const pv = Number(m.product?.prixVente || selectedProduct?.prixVente || 0);
    return sum + (Math.abs(Number(m.quantite)) * pv);
  }, 0);

  // Label de la période
  const getPeriodLabel = () => {
    if (period === 'today') return 'Aujourd’hui';
    if (period === 'week') return 'Les 7 derniers jours';
    if (period === 'month') return 'Ce mois-ci';
    if (period === 'year') return 'Cette année';
    if (period === 'custom') return `Du ${startDate || '...'} au ${endDate || '...'}`;
    return 'Tout l’historique';
  };

  // Impression
  const handlePrint = async (format = 'a4') => {
    if (!selectedProduct && movements.length === 0) return;
    try {
      const cfg = getPrinterSettings();
      const html = generateProductMovementHtml({
        product: selectedProduct || { nom: 'Tous les produits', quantite: '-' },
        movements,
        stats: { initialStock, totalEntries, totalExits, netVariation },
        periodLabel: getPeriodLabel(),
        format,
        settings: cfg
      });
      await printHtmlContent(html, format);
    } catch (err) {
      console.error('Erreur impression mouvements:', err);
    }
  };

  // Export Excel
  const handleExportExcel = async () => {
    try {
      await api.stock.exportMovementsExcel({
        productId: selectedProduct ? (selectedProduct.id || selectedProduct._id) : undefined,
        type: selectedType !== 'TOUS' ? selectedType : undefined,
        startDate: period === 'custom' ? startDate : undefined,
        endDate: period === 'custom' ? endDate : undefined,
        period: period !== 'custom' ? period : undefined
      });
    } catch (e) {
      console.error('Erreur export Excel:', e);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* BARRE PRINCIPALE : INPUT LIBRE AVEC SUGGESTION + FILTRE DE DATE */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Fiche & Historique des Mouvements par Produit</span>
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Sélectionnez un article pour tracer l'ensemble de ses entrées, sorties, ventes, achats et ajustements
            </p>
          </div>

          {/* Raccourcis Export & Impression */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePrint('a4')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Imprimer la fiche au format A4"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer Fiche (A4)</span>
            </button>

            <button
              type="button"
              onClick={() => handlePrint('80mm')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Ticket thermique 80mm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Ticket 80mm</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Exporter vers Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
          </div>
        </div>

        {/* INPUT LIBRE AVEC SUGGESTION DE DISPONIBILITÉ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-7 relative" ref={containerRef}>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Rechercher & Choisir le Produit :
            </label>

            <div className="relative flex items-center">
              <div className="absolute left-3.5 pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>

              <input
                ref={inputRef}
                type="text"
                value={productSearchTerm}
                onChange={handleInputChange}
                onFocus={() => setIsAutocompleteOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Taper nom, référence, code-barres, catégorie ou scanner..."
                className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border rounded-2xl text-xs font-bold transition-all focus:outline-none ${
                  selectedProduct
                    ? 'border-blue-500 bg-blue-50/20 text-slate-900 ring-2 ring-blue-500/10'
                    : 'border-slate-300 text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />

              {productSearchTerm && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition cursor-pointer"
                  title="Effacer la sélection (voir tous)"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Menu flottant des suggestions */}
            {isAutocompleteOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl divide-y divide-slate-100">
                <div className="px-3.5 py-2 bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider flex justify-between items-center">
                  <span>Suggestions d'articles ({filteredSuggestions.length})</span>
                  <span>Disponibilité & Tarifs</span>
                </div>

                {filteredSuggestions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    <Package className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                    <span>Aucun article trouvé pour "{productSearchTerm}"</span>
                  </div>
                ) : (
                  filteredSuggestions.map((p, idx) => {
                    const isSelected = selectedProduct && (p._id === selectedProduct._id || p.id === selectedProduct.id);
                    const isHighlighted = idx === highlightedIndex;
                    const stock = Number(p.quantite || 0);
                    const alert = Number(p.stockAlerte || 5);

                    return (
                      <div
                        key={p._id || p.id || idx}
                        onClick={() => handleSelectProduct(p)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                          isHighlighted ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'
                        } ${isSelected ? 'bg-blue-100/60 font-black' : ''}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 truncate">{p.nom}</span>
                            {isSelected && (
                              <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded text-[9px] font-bold">
                                Actif
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                            {p.reference && <span>Réf: {p.reference}</span>}
                            {p.codeBarre && (
                              <span className="flex items-center gap-0.5">
                                <Barcode className="w-3 h-3 text-slate-400" />
                                {p.codeBarre}
                              </span>
                            )}
                            {p.categorie && <span>• {p.categorie}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-right">
                          {/* Badge Disponibilité */}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            stock > alert
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : stock > 0
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            {stock > 0 ? `Stock : ${stock} ${p.unite || 'pcs'}` : 'Rupture (0)'}
                          </span>

                          <div className="text-right">
                            <div className="text-xs font-black text-slate-900">
                              {(p.prixVente || 0).toLocaleString('fr-DZ')} DA
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Achat: {(p.prixAchat || 0).toLocaleString('fr-DZ')} DA
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* FILTRE DE TYPE DE MOUVEMENT */}
          <div className="lg:col-span-5">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Type d'Opération :
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-blue-500 cursor-pointer"
              >
                <option value="TOUS">Tous les types de mouvements</option>
                <option value="VENTE">Ventes en caisse (-)</option>
                <option value="ACHAT_FOURNISSEUR">Achats & Réceptions (+)</option>
                <option value="PIECE_REPARATION_SAV">Pièces atelier SAV (-)</option>
                <option value="RETOUR_VENTE">Retours de vente / Avoirs (+)</option>
                <option value="PERTE">Pertes & Démarques (-)</option>
                <option value="AJUSTEMENT_INVENTAIRE">Ajustements Inventaire</option>
              </select>

              <button
                type="button"
                onClick={loadMovements}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition cursor-pointer shrink-0"
                title="Actualiser les mouvements"
              >
                <RefreshCw className={`w-4 h-4 ${loadingMovements ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* FILTRE DE DATE COMPLET (Raccourcis + Date début / fin) */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Période :</span>
            </span>

            {[
              { id: 'today', label: 'Aujourd’hui' },
              { id: 'week', label: '7 jours' },
              { id: 'month', label: 'Ce mois' },
              { id: 'year', label: 'Cette année' },
              { id: 'all', label: 'Tout' },
              { id: 'custom', label: 'Personnalisé' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                  period === p.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Inputs dates personnalisées */}
          {period === 'custom' && (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 animate-in fade-in duration-150 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-500">Du :</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-500">Au :</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FICHE D'IDENTITÉ DU PRODUIT SÉLECTIONNÉ */}
      {selectedProduct ? (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 rounded-3xl shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-600/30 border border-blue-400/40 rounded-2xl shrink-0">
              <Package className="w-7 h-7 text-blue-400" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-black tracking-wide text-white">
                  {selectedProduct.nom}
                </h4>
                {selectedProduct.categorie && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    {selectedProduct.categorie}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1">
                <span>Réf : <strong className="text-white font-mono">{selectedProduct.reference || '---'}</strong></span>
                {selectedProduct.codeBarre && (
                  <span>Code-barres : <strong className="text-white font-mono">{selectedProduct.codeBarre}</strong></span>
                )}
                {selectedProduct.emplacement && (
                  <span>Emplacement : <strong className="text-white">{selectedProduct.emplacement}</strong></span>
                )}
                {selectedProduct.fournisseur && (
                  <span>Fournisseur : <strong className="text-white">{selectedProduct.fournisseur}</strong></span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Tarifs et stock actuel */}
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Stock Actuel en Rayon</div>
              <div className="text-2xl font-black text-emerald-400">
                {selectedProduct.quantite || 0} <span className="text-xs font-bold text-slate-300">{selectedProduct.unite || 'pcs'}</span>
              </div>
              <div className="text-[11px] text-slate-300 font-bold mt-0.5">
                Vente : <span className="text-white">{(selectedProduct.prixVente || 0).toLocaleString('fr-DZ')} DA</span>
                {' '}| Achat : <span className="text-slate-400">{(selectedProduct.prixAchat || 0).toLocaleString('fr-DZ')} DA</span>
              </div>
            </div>

            {/* Bouton pour ajuster manuellement */}
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(true)}
              className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black transition shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Ajustement de stock manuel (+ ou -)"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Ajuster Stock</span>
            </button>
          </div>
        </div>
      ) : (
        /* Suggestions rapides si aucun produit n'est sélectionné */
        <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-3xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-blue-900 font-bold">
            <Package className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Articles suggérés récemment mouvementés :</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {products.slice(0, 6).map(p => (
              <button
                key={p._id || p.id}
                type="button"
                onClick={() => handleSelectProduct(p)}
                className="px-2.5 py-1 bg-white hover:bg-blue-100/70 border border-blue-200 rounded-xl font-bold text-slate-700 text-xs transition cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <span>{p.nom}</span>
                <span className="text-[10px] text-blue-600 font-black">({p.quantite || 0})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SYNTHÈSE DES FLUX & KPIS SUR LA PÉRIODE */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Stock Initial */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Stock Initial</span>
          <div className="text-lg font-black text-slate-700 mt-1">
            {initialStock !== null ? `${initialStock} ${selectedProduct?.unite || 'pcs'}` : '---'}
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">En début de période</span>
        </div>

        {/* 2. Total Entrées */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Entrées (+)</span>
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-black text-emerald-600 mt-1">
            +{totalEntries} <span className="text-xs font-bold text-slate-400">{selectedProduct?.unite || 'pcs'}</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Achats, retours, ajust.</span>
        </div>

        {/* 3. Total Sorties */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sorties (-)</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-lg font-black text-rose-600 mt-1">
            -{totalExits} <span className="text-xs font-bold text-slate-400">{selectedProduct?.unite || 'pcs'}</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Ventes, SAV, pertes</span>
        </div>

        {/* 4. Variation Nette */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Variation Nette</span>
          <div className={`text-lg font-black mt-1 ${netVariation >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {netVariation > 0 ? `+${netVariation}` : netVariation} <span className="text-xs font-bold text-slate-400">{selectedProduct?.unite || 'pcs'}</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Solde des mouvements</span>
        </div>

        {/* 5. Ventes sur la période */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Ventes</span>
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-lg font-black text-blue-600 mt-1">
            {totalVentesQty} <span className="text-xs font-bold text-slate-400">{selectedProduct?.unite || 'pcs'}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
            CA: {totalVentesCA.toLocaleString('fr-DZ')} DA
          </span>
        </div>

        {/* 6. Stock Final / Actuel */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Stock Actuel</span>
          <div className="text-lg font-black text-slate-900 mt-1">
            {selectedProduct ? `${selectedProduct.quantite || 0} ${selectedProduct.unite || 'pcs'}` : `${movements.length} ops`}
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {selectedProduct ? 'En inventaire' : 'Opérations filtrées'}
          </span>
        </div>
      </div>

      {/* TABLEAU CHRONOLOGIQUE DES MOUVEMENTS */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Journal Détaillé des Mouvements ({movements.length})
            </h4>
          </div>
          <div className="text-xs font-bold text-slate-500">
            Période : <strong className="text-slate-800">{getPeriodLabel()}</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Date & Heure</th>
                <th className="py-3 px-4">Opération / Type</th>
                {!selectedProduct && <th className="py-3 px-4">Article</th>}
                <th className="py-3 px-4">Document Réf</th>
                <th className="py-3 px-4">Tiers / Fournisseur</th>
                <th className="py-3 px-4 text-center">Variation</th>
                <th className="py-3 px-4 text-center">Stock Avant → Après</th>
                <th className="py-3 px-4 text-right">P.U (DA)</th>
                <th className="py-3 px-4">Motif / Observation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loadingMovements ? (
                <tr>
                  <td colSpan={selectedProduct ? 8 : 9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Chargement de l'historique des mouvements...</span>
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={selectedProduct ? 8 : 9} className="py-12 text-center text-slate-400">
                    <ArrowLeftRight className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-bold text-slate-700">Aucun mouvement trouvé</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedProduct
                        ? `Aucun mouvement enregistré pour "${selectedProduct.nom}" sur la période sélectionnée.`
                        : 'Aucun mouvement de stock sur cette période.'}
                    </p>
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const isPos = Number(m.quantite || 0) > 0;
                  const dateObj = new Date(m.dateMouvement || m.createdAt);
                  const dateStr = isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleString('fr-DZ', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  });

                  // Badge de type
                  let typeBadgeClass = 'bg-slate-100 text-slate-800 border-slate-200';
                  let TypeIcon = ArrowLeftRight;
                  let typeLabel = (m.type || '').replace(/_/g, ' ');

                  if (m.type === 'VENTE') {
                    typeBadgeClass = 'bg-purple-50 text-purple-800 border-purple-200';
                    TypeIcon = ArrowUpRight;
                    typeLabel = 'Vente en caisse';
                  } else if (m.type === 'ACHAT_FOURNISSEUR') {
                    typeBadgeClass = 'bg-blue-50 text-blue-800 border-blue-200';
                    TypeIcon = Truck;
                    typeLabel = 'Achat Fournisseur';
                  } else if (m.type === 'PIECE_REPARATION_SAV' || m.type === 'SORTIE_REPARATION') {
                    typeBadgeClass = 'bg-amber-100 text-amber-900 border-amber-300 font-black';
                    TypeIcon = Wrench;
                    typeLabel = 'Pièce Atelier SAV';
                  } else if (m.type === 'ANNULATION_REPARATION' || m.type === 'RETOUR_SAV') {
                    typeBadgeClass = 'bg-cyan-50 text-cyan-800 border-cyan-200';
                    TypeIcon = RotateCcw;
                    typeLabel = 'Restitution SAV';
                  } else if (m.type === 'RETOUR_VENTE') {
                    typeBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    TypeIcon = RotateCcw;
                    typeLabel = 'Retour Client';
                  } else if (m.type === 'PERTE' || m.type === 'PERTE_CASSE' || m.type === 'MODIFICATION_PERTE') {
                    typeBadgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
                    TypeIcon = AlertTriangle;
                    typeLabel = 'Perte / Casse';
                  } else if (m.type === 'AJUSTEMENT_INVENTAIRE' || m.type === 'AJUSTEMENT_POSITIF' || m.type === 'AJUSTEMENT_NEGATIF') {
                    typeBadgeClass = 'bg-slate-100 text-slate-800 border-slate-200';
                    TypeIcon = Sliders;
                    typeLabel = 'Ajustement';
                  }

                  return (
                    <tr key={m._id || m.id} className="hover:bg-slate-50/80 transition">
                      {/* Date & Heure */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {dateStr}
                      </td>

                      {/* Type d'opération */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${typeBadgeClass}`}>
                          <TypeIcon className="w-3 h-3" />
                          <span>{typeLabel}</span>
                        </span>
                      </td>

                      {/* Article (si pas de produit unique sélectionné) */}
                      {!selectedProduct && (
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleSelectProduct(m.product)}
                            className="text-left group cursor-pointer"
                          >
                            <span className="font-bold text-slate-800 group-hover:text-blue-600 block truncate max-w-xs">
                              {m.product?.nom || 'Article inconnu'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Réf: {m.product?.reference || '-'}
                            </span>
                          </button>
                        </td>
                      )}

                      {/* Réf Document */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {m.referenceDocument ? (
                          <span className="font-mono text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                            {m.referenceDocument}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Manuel</span>
                        )}
                      </td>

                      {/* Tiers / Fournisseur */}
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {m.fournisseur || m.tiers || '-'}
                      </td>

                      {/* Variation */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-xl text-xs font-black ${
                          isPos ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {isPos ? `+${m.quantite}` : m.quantite} {m.product?.unite || selectedProduct?.unite || 'pcs'}
                        </span>
                      </td>

                      {/* Avant → Après */}
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {m.quantiteAvant} → <strong className="text-slate-900">{m.quantiteApres}</strong>
                      </td>

                      {/* P.U */}
                      <td className="py-3 px-4 text-right font-bold text-slate-800 whitespace-nowrap">
                        {Number(m.prixAchatUnitaire || 0) > 0 ? (
                          <span>{Number(m.prixAchatUnitaire).toLocaleString('fr-DZ')} DA</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Motif / Observation */}
                      <td className="py-3 px-4 text-slate-500 text-xs">
                        <span className="truncate max-w-xs block font-medium">
                          {m.motif || '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal d'ajustement manuel rapide de stock */}
      {selectedProduct && isAdjustModalOpen && (
        <StockMovementModal
          isOpen={isAdjustModalOpen}
          onClose={() => setIsAdjustModalOpen(false)}
          product={selectedProduct}
          onSaved={() => {
            fetchProducts();
            loadMovements();
            setIsAdjustModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
