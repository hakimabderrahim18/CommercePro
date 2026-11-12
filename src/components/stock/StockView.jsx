import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Barcode,
  QrCode, 
  FileSpreadsheet, 
  Upload, 
  Edit3, 
  Trash2, 
  PlusCircle, 
  AlertTriangle,
  RefreshCw,
  Layers,
  ArrowUpDown,
  ClipboardCheck,
  Printer,
  TrendingUp,
  Sparkles,
  DollarSign,
  ArrowLeftRight
} from 'lucide-react';
import { api } from '../../services/api';
import ProductModal from './ProductModal';
import ProductQrModal from './ProductQrModal';
import StockMovementModal from './StockMovementModal';
import StockInventoryModal from './StockInventoryModal';
import ProductMovementsModal from '../movements/ProductMovementsModal';
import ExportColumnsModal from '../common/ExportColumnsModal';
import { useLanguage } from '../../context/LanguageContext';
import { printHtmlContent } from '../../utils/printerHelper';

const STOCK_EXPORT_COLUMNS = [
  { key: 'reference', label: 'Référence Produit', group: '1. Identification' },
  { key: 'codeBarre', label: 'Code-Barres Principal', group: '1. Identification' },
  { key: 'codesBarres', label: 'Tous Codes-Barres', group: '1. Identification' },
  { key: 'nom', label: 'Désignation / Nom', group: '1. Identification' },
  { key: 'categorie', label: 'Catégorie', group: '1. Identification' },

  { key: 'taille', label: 'Taille', group: '2. Caractéristiques' },
  { key: 'pointure', label: 'Pointure', group: '2. Caractéristiques' },
  { key: 'couleur', label: 'Couleur', group: '2. Caractéristiques' },
  { key: 'genre', label: 'Genre (Homme/Femme/Enfant)', group: '2. Caractéristiques' },

  { key: 'prixAchat', label: 'Prix d’Achat (DA)', group: '3. Tarifs & Prix' },
  { key: 'prixVente', label: 'Prix Vente Détail (DA)', group: '3. Tarifs & Prix' },
  { key: 'prixDemiGros', label: 'Prix Demi-Gros (DA)', group: '3. Tarifs & Prix' },
  { key: 'prixGros', label: 'Prix Gros (DA)', group: '3. Tarifs & Prix' },
  { key: 'prixSuperGros', label: 'Prix Super Gros (DA)', group: '3. Tarifs & Prix' },

  { key: 'quantite', label: 'Quantité en Stock', group: '4. Stock & Logistique' },
  { key: 'unite', label: 'Unité (pcs, kg...)', group: '4. Stock & Logistique' },
  { key: 'seuilAlerte', label: 'Seuil d’Alerte Rupture', group: '4. Stock & Logistique' },
  { key: 'fournisseur', label: 'Fournisseur Principal', group: '4. Stock & Logistique' },

  { key: 'valeurAchat', label: 'Valeur Stock au Prix d’Achat (DA)', group: '5. Valorisation & Statut' },
  { key: 'valeurVente', label: 'Valeur Stock au Prix de Vente (DA)', group: '5. Valorisation & Statut' },
  { key: 'beneficeStock', label: 'Bénéfice Stock Potentiel (DA)', group: '5. Valorisation & Statut' },
  { key: 'statutRupture', label: 'Statut Rupture (Alerte / OK)', group: '5. Valorisation & Statut' }
];

export default function StockView({ onNewProductTrigger }) {
  const { t, isRTL } = useLanguage();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TOUS');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [stockLevelFilter, setStockLevelFilter] = useState('TOUS'); // 'TOUS' | 'EN_STOCK' | 'STOCK_FAIBLE' | 'RUPTURE'
  const [sortBy, setSortBy] = useState('nom'); // 'nom' | 'reference' | 'prix' | 'stock'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [maxPriceFilter, setMaxPriceFilter] = useState(0);

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrProduct, setQrProduct] = useState(null);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementProduct, setMovementProduct] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [notification, setNotification] = useState(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.stock.getAll({
        search,
        categorie: selectedCategory,
        lowStockOnly
      });
      if (res && res.success) {
        setProducts(Array.isArray(res.data) ? res.data : []);
        if (Array.isArray(res.categories) && res.categories.length > 0) {
          setCategories(res.categories);
        }
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error('Erreur chargement stock:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, selectedCategory, lowStockOnly]);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleExportExcel = () => {
    setIsExportModalOpen(true);
  };

  const handleExecuteExport = async (columns) => {
    const res = await api.stock.exportExcel({ columns });
    if (res.success) {
      showToast(`Export réussi ! ${res.count} articles exportés avec ${columns.length} colonnes sélectionnées.`);
    }
  };

  const handleImportExcel = async () => {
    const res = await api.stock.importExcel();
    if (res.success) {
      showToast(res.message);
      fetchProducts();
    } else if (res.error) {
      showToast(res.error, 'error');
    }
  };

  const handleDeleteProduct = async (product) => {
    if (window.confirm(`Voulez-vous vraiment supprimer/archiver l'article "${product.nom}" ?`)) {
      const res = await api.stock.delete(product._id);
      if (res.success) {
        showToast('Article archivé avec succès.');
        fetchProducts();
      }
    }
  };

  // KPI calculations
  const safeProducts = Array.isArray(products) ? products : [];
  const totalArticles = safeProducts.length;
  const totalStockQty = safeProducts.reduce((sum, p) => sum + (Number(p.quantite) || 0), 0);
  const totalStockPurchaseValue = safeProducts.reduce((sum, p) => sum + ((Number(p.quantite) || 0) * (Number(p.prixAchat) || 0)), 0);
  const totalStockSaleValue = safeProducts.reduce((sum, p) => sum + ((Number(p.quantite) || 0) * (Number(p.prixVente) || 0)), 0);
  const totalStockValue = totalStockSaleValue;
  const totalStockProfit = totalStockSaleValue - totalStockPurchaseValue;
  const profitMarginPercent = totalStockPurchaseValue > 0 ? ((totalStockProfit / totalStockPurchaseValue) * 100).toFixed(1) : '0';
  const alertCount = safeProducts.filter((p) => (Number(p.quantite) || 0) <= (Number(p.seuilAlerte) || 5)).length;

  const maxProductPrice = Math.max(0, ...safeProducts.map(p => Number(p.prixVente) || 0));
  const sliderMax = Math.max(10000, Math.ceil(maxProductPrice / 1000) * 1000);

  const inStockCount = safeProducts.filter((p) => (Number(p.quantite) || 0) > (Number(p.seuilAlerte) || 5)).length;
  const lowStockCount = safeProducts.filter((p) => (Number(p.quantite) || 0) > 0 && (Number(p.quantite) || 0) <= (Number(p.seuilAlerte) || 5)).length;
  const ruptureCount = safeProducts.filter((p) => (Number(p.quantite) || 0) <= 0).length;

  const filteredProducts = safeProducts.filter((p) => {
    const qty = Number(p.quantite) || 0;
    const seuil = Number(p.seuilAlerte) || 5;
    const pv = Number(p.prixVente) || 0;

    if (stockLevelFilter === 'EN_STOCK' && qty <= seuil) return false;
    if (stockLevelFilter === 'STOCK_FAIBLE' && (qty <= 0 || qty > seuil)) return false;
    if (stockLevelFilter === 'RUPTURE' && qty > 0) return false;
    if (maxPriceFilter > 0 && pv > maxPriceFilter) return false;
    if (selectedCategory && selectedCategory !== 'TOUS') {
      const pCat = (p.categorie || '').trim().toLowerCase();
      const selCat = String(selectedCategory).trim().toLowerCase();
      if (pCat !== selCat) return false;
    }

    return true;
  }).sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'reference') {
      cmp = (a.reference || '').localeCompare(b.reference || '');
    } else if (sortBy === 'prix') {
      cmp = (Number(a.prixVente) || 0) - (Number(b.prixVente) || 0);
    } else if (sortBy === 'stock') {
      cmp = (Number(a.quantite) || 0) - (Number(b.quantite) || 0);
    } else {
      cmp = (a.nom || '').localeCompare(b.nom || '');
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const handlePrintStock = async () => {
    try {
      const itemsRows = safeProducts.map((p) => {
        const qty = Number(p.quantite) || 0;
        const pa = Number(p.prixAchat) || 0;
        const pv = Number(p.prixVente) || 0;
        const totalVente = qty * pv;
        return `
          <tr>
            <td style="font-family: monospace;">${p.codeBarre || p.reference || '-'}</td>
            <td style="font-weight: bold;">${p.nom || ''}</td>
            <td>${p.categorie || '-'}</td>
            <td style="text-align: right;">${pa.toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</td>
            <td style="text-align: right; font-weight: bold;">${pv.toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</td>
            <td style="text-align: center; font-weight: bold;">${qty} ${p.unite || 'pcs'}</td>
            <td style="text-align: right; font-weight: bold;">${totalVente.toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</td>
          </tr>
        `;
      }).join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>État du Stock - ${new Date().toLocaleDateString('fr-DZ')}</title>
            <style>
              @page { size: A4 landscape; margin: 10mm; }
              * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              body { background: white; color: #0f172a; font-size: 11px; line-height: 1.4; padding: 10px; }
              .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
              .kpis { display: flex; gap: 20px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; margin-bottom: 12px; font-size: 11px; }
              table { width: 100%; border-collapse: collapse; margin-top: 8px; }
              th, td { border: 1px solid #cbd5e1; padding: 5px 8px; font-size: 10px; }
              th { background: #f1f5f9; font-weight: 800; text-transform: uppercase; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1 style="font-size: 18px; font-weight: 900; text-transform: uppercase;">CommercePost - État du Stock</h1>
                <p style="color: #64748b; font-size: 11px;">Inventaire général et valorisation du stock</p>
              </div>
              <div style="text-align: right;">
                <p style="font-weight: bold;">Date : ${new Date().toLocaleString('fr-DZ')}</p>
                <p style="color: #64748b;">${totalArticles} références enregistrées</p>
              </div>
            </div>
            <div class="kpis">
              <div><strong>Total Articles :</strong> ${totalArticles} réf.</div>
              <div><strong>Quantité Totale :</strong> ${totalStockQty} unités</div>
              <div><strong>Valeur Stock Achat :</strong> ${totalStockPurchaseValue.toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</div>
              <div><strong>Valeur Stock Vente :</strong> ${totalStockSaleValue.toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</div>
              <div><strong>Bénéfice Potentiel :</strong> ${totalStockProfit.toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Réf / Code</th>
                  <th>Désignation</th>
                  <th>Catégorie</th>
                  <th style="text-align: right;">P.U Achat</th>
                  <th style="text-align: right;">P.U Vente</th>
                  <th style="text-align: center;">Quantité</th>
                  <th style="text-align: right;">Total Vente</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>
          </body>
        </html>
      `;

      await printHtmlContent(html, {
        pageSize: 'A4',
        landscape: true,
        silent: false
      });
    } catch (e) {
      showToast(`Erreur impression: ${e.message}`, 'error');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-xl border text-sm font-semibold flex items-center justify-between animate-in slide-in-from-top duration-200 ${
          notification.type === 'error' 
            ? 'bg-rose-50 border-rose-200 text-rose-700' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          <span>{notification.msg}</span>
          <button onClick={() => setNotification(null)} className="text-xs font-bold underline cursor-pointer">Fermer</button>
        </div>
      )}

      {/* Header & Quick stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">{t('stock_title')}</h2>
          <p className="text-xs text-slate-500 font-medium">{t('stock_subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsInventoryModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl transition shadow-xs cursor-pointer"
            title="Comparaison physique vs logiciel, calcul d'écarts et rapprochement"
          >
            <ClipboardCheck className="w-4 h-4 text-indigo-600" />
            <span>{t('stock_btnInventory')}</span>
          </button>

          <button
            onClick={handlePrintStock}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-xs cursor-pointer"
            title="Imprimer l'état valorisé du stock"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>{t('stock_btnPrintStock')}</span>
          </button>

          <button
            onClick={handleImportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-xs cursor-pointer"
          >
            <Upload className="w-4 h-4 text-blue-600" />
            <span>{t('stock_importExcel')}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-xl transition shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{t('stock_exportExcel')}</span>
          </button>

          <button
            onClick={() => {
              setSelectedProduct(null);
              setIsProductModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('stock_addProduct')}</span>
          </button>
        </div>
      </div>

      {/* Stock Summary Cards (5 Cards: Volume, Valeur Achat, Valeur Vente, Bénéfice Stock, Alertes) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 1. Volume & Quantité */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">{t('stock_totalReferences')}</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-800">{totalArticles}</span>
              <span className="text-xs font-bold text-slate-400">réf.</span>
            </div>
            <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
              {totalStockQty.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} unités en stock
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* 2. Valeur Stock (Prix d'Achat) */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Valeur Stock (Achat)</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-slate-800">{totalStockPurchaseValue.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
              <span className="text-xs font-bold text-slate-500">{t('currency')}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
              Coût d'achat total déboursé
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* 3. Valeur Stock (Prix de Vente) */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Valeur Stock (Vente)</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-blue-700">{totalStockSaleValue.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
              <span className="text-xs font-bold text-blue-600">{t('currency')}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
              Chiffre d'affaires potentiel
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* 4. Bénéfice Stock Potentiel */}
        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 bg-linear-to-br from-white to-emerald-50/30 shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-emerald-800 block uppercase tracking-wider">Bénéfice Stock</span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                +{profitMarginPercent}%
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-emerald-700">{totalStockProfit.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
              <span className="text-xs font-bold text-emerald-600">{t('currency')}</span>
            </div>
            <span className="text-[10px] text-emerald-600/80 font-semibold block mt-0.5">
              Marge brute disponible
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        {/* 5. Alerte Stock Faible */}
        <div 
          onClick={() => setLowStockOnly(!lowStockOnly)}
          className={`p-3.5 rounded-2xl border shadow-2xs flex items-center justify-between cursor-pointer transition ${
            lowStockOnly 
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400' 
              : 'bg-white border-slate-200 hover:border-rose-200'
          }`}
        >
          <div>
            <span className="text-[11px] font-bold text-rose-600 block uppercase tracking-wider">{t('stock_lowStockCount')}</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-rose-700">{alertCount}</span>
              <span className="text-xs font-bold text-rose-500">{t('articles')}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
              Articles au seuil critique
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar (Photo 504 Enriched Layout) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
        {/* Ligne 1: Recherche globale + Bouton Actualiser */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par référence, désignation, catégorie, code-barres..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
            />
          </div>
          <button
            onClick={fetchProducts}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            title="Rafraîchir la liste"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Ligne 2: Grille 4 colonnes (Catégorie, Niveau de stock, Slider Prix, Trier par) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-1 border-t border-slate-100">
          {/* 1. Catégorie (Pills cliquables) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-slate-700">Catégorie :</span>
              {selectedCategory !== 'TOUS' && (
                <button
                  onClick={() => setSelectedCategory('TOUS')}
                  className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  Réinitialiser
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-slate-50/80 rounded-xl border border-slate-200">
              <button
                onClick={() => setSelectedCategory('TOUS')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                  selectedCategory === 'TOUS' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                TOUS
              </button>
              {categories.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedCategory(c)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                    selectedCategory === c ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Niveau de stock (Photo 504 exact match) */}
          <div>
            <span className="font-bold text-slate-700 block mb-1.5">Niveau de stock :</span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'TOUS', label: 'Tous', count: safeProducts.length, color: 'bg-slate-900 text-white' },
                { id: 'EN_STOCK', label: 'En stock', count: inStockCount, color: 'bg-emerald-600 text-white' },
                { id: 'STOCK_FAIBLE', label: 'Stock faible', count: lowStockCount, color: 'bg-amber-600 text-white' },
                { id: 'RUPTURE', label: 'Rupture', count: ruptureCount, color: 'bg-rose-600 text-white' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setStockLevelFilter(item.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition flex items-center justify-between border ${
                    stockLevelFilter === item.id
                      ? `${item.color} border-transparent shadow-xs`
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    stockLevelFilter === item.id ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Curseur Filtre Prix (Photo 504 slider) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-slate-700">Prix de vente :</span>
              <span className="text-[11px] font-black text-blue-600">
                {maxPriceFilter > 0 ? `≤ ${maxPriceFilter.toLocaleString('fr-DZ')} DA` : 'Tous prix'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={sliderMax}
              step="100"
              value={maxPriceFilter || sliderMax}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMaxPriceFilter(val >= sliderMax ? 0 : val);
              }}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1">
              <span>0 DA</span>
              <span>{sliderMax.toLocaleString('fr-DZ')} DA</span>
            </div>
          </div>

          {/* 4. Trier par + Ordre (Photo 504 dropdown) */}
          <div>
            <span className="font-bold text-slate-700 block mb-1.5">Trier par :</span>
            <div className="flex items-center gap-1.5">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:bg-white focus:outline-blue-500"
              >
                <option value="nom">Désignation (A - Z)</option>
                <option value="reference">Référence</option>
                <option value="prix">Prix</option>
                <option value="stock">Quantité Stock</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-700 font-bold cursor-pointer transition"
                title={`Ordre actuel : ${sortOrder === 'asc' ? 'Croissant (A-Z)' : 'Décroissant (Z-A)'}`}
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Ligne 3: Récapitulatif dynamique fidèle Photo 504 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs font-bold text-slate-600">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-900">
              <Package className="w-4 h-4 text-blue-600" />
              <span>{filteredProducts.length} articles ({filteredProducts.reduce((sum, p) => sum + (Number(p.quantite) || 0), 0)} pièces)</span>
            </span>
            {lowStockCount > 0 && (
              <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>{lowStockCount} stock faible</span>
              </span>
            )}
            {ruptureCount > 0 && (
              <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                <span>{ruptureCount} rupture</span>
              </span>
            )}
          </div>

          {(selectedCategory !== 'TOUS' || stockLevelFilter !== 'TOUS' || maxPriceFilter > 0 || search) && (
            <button
              onClick={() => {
                setSelectedCategory('TOUS');
                setStockLevelFilter('TOUS');
                setMaxPriceFilter(0);
                setSearch('');
              }}
              className="text-[11px] text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
            >
              Effacer tous les filtres
            </button>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">{t('stock_refBarcode')}</th>
                <th className="px-5 py-3">{t('stock_designation')}</th>
                <th className="px-5 py-3">{t('stock_category')}</th>
                <th className="px-5 py-3 text-right">{t('stock_purchasePrice')}</th>
                <th className="px-5 py-3 text-right">{t('stock_salePrice')}</th>
                <th className="px-5 py-3 text-center">{t('stock_inStock')}</th>
                <th className="px-5 py-3">{t('stock_supplier')}</th>
                <th className="px-5 py-3 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((p) => {
                  const isLow = (p.quantite || 0) <= (p.seuilAlerte || 5);
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setQrProduct(p);
                              setIsQrModalOpen(true);
                            }}
                            className="p-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition cursor-pointer shadow-2xs"
                            title="Voir & Imprimer le Code-Barres"
                          >
                            <Barcode className="w-4 h-4" />
                          </button>
                          <div>
                            <span className="font-mono font-bold text-slate-800 block">{p.codeBarre || p.reference}</span>
                            {p.codesBarres && p.codesBarres.length > 1 && (
                              <span 
                                className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[9px] font-bold cursor-help"
                                title={`Codes-barres associés : ${p.codesBarres.join(', ')}`}
                              >
                                +{p.codesBarres.length - 1} code{p.codesBarres.length > 2 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={p.nom}
                              className="w-10 h-10 object-cover rounded-xl border border-slate-200 bg-slate-50 shrink-0 shadow-2xs"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 text-sm block">{p.nom}</span>
                            {(p.taille || p.pointure || p.couleur || (p.genre && p.genre !== 'UNISEXE')) && (
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                {p.taille && (
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-bold text-[10px]">
                                    T: {p.taille}
                                  </span>
                                )}
                                {p.pointure && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/80 font-bold text-[10px]">
                                    P: {p.pointure}
                                  </span>
                                )}
                                {p.couleur && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[10px]">
                                    {p.couleur}
                                  </span>
                                )}
                                {p.genre && p.genre !== 'UNISEXE' && (
                                  <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-semibold text-[10px]">
                                    {p.genre}
                                  </span>
                                )}
                              </div>
                            )}
                            {isLow && (
                              <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3 h-3" /> Stock faible (Seuil: {p.seuilAlerte})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold text-[11px]">
                          {p.categorie || 'Général'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-slate-500">
                        {Number(p.prixAchat || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-slate-800 text-sm">
                        <div>{Number(p.prixVente || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</div>
                        {Number(p.prixAchat || 0) > 0 && (
                          <div className="text-[10px] font-bold text-emerald-600">
                            +{(Number(p.prixVente || 0) - Number(p.prixAchat || 0)).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black ${
                            isLow
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {p.quantite} {p.unite}
                        </span>
                        <div className="text-[9px] text-slate-400 font-bold mt-0.5">
                          {(Number(p.quantite || 0) * Number(p.prixVente || 0)).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-medium">
                        {p.fournisseur || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Movements history */}
                          <button
                            onClick={() => {
                              setHistoryProduct(p);
                              setIsHistoryModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition cursor-pointer"
                            title="Historique des mouvements de ce produit"
                          >
                            <ArrowLeftRight className="w-4 h-4" />
                          </button>

                          {/* Add Stock button */}
                          <button
                            onClick={() => {
                              setMovementProduct(p);
                              setIsMovementModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer"
                            title="Réapprovisionner / Ajuster stock"
                          >
                            <PlusCircle className="w-4 h-4" />
                          </button>

                          {/* Edit Product */}
                          <button
                            onClick={() => {
                              setSelectedProduct(p);
                              setIsProductModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition cursor-pointer"
                            title="Modifier l'article"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Delete Product */}
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                            title="Archiver l'article"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400 text-xs">
                    {loading ? 'Chargement des produits...' : 'Aucun produit trouvé dans votre catalogue.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        product={selectedProduct}
        onSaved={(savedProduct) => {
          showToast(selectedProduct ? 'Produit modifié avec succès !' : 'Produit enregistré avec succès et code-barres généré !');
          fetchProducts();
          if (savedProduct) {
            setQrProduct(savedProduct);
            setIsQrModalOpen(true);
          }
        }}
      />

      <ProductQrModal
        isOpen={isQrModalOpen}
        onClose={() => {
          setIsQrModalOpen(false);
          setQrProduct(null);
        }}
        product={qrProduct}
      />

      <StockMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        product={movementProduct}
        onSaved={fetchProducts}
      />

      <ProductMovementsModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setHistoryProduct(null);
        }}
        product={historyProduct}
      />

      <StockInventoryModal
        isOpen={isInventoryModalOpen}
        onClose={() => setIsInventoryModalOpen(false)}
        onInventoryApplied={fetchProducts}
      />

      <ExportColumnsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Personnaliser les Colonnes d'Exportation Excel (Stock)"
        availableColumns={STOCK_EXPORT_COLUMNS}
        onConfirm={handleExecuteExport}
      />

      {/* Printable Stock Catalog Section */}
      <div className="print-area hidden">
        <div className="p-6 bg-white space-y-6 text-black">
          <div className="flex justify-between items-start border-b-2 border-black pb-4">
            <div>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1">
                COMMERCEPOST - ÉTAT DU STOCK & VALORISATION
              </span>
              <h1 className="text-xl font-black uppercase tracking-tight">{t('appTitle')}</h1>
              <p className="text-xs text-slate-600">{t('appSubtitle')}</p>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-100 border border-black font-black text-xs uppercase mb-1">
                INVENTAIRE GÉNÉRAL
              </span>
              <p className="text-xs">Date : <strong>{new Date().toLocaleString('fr-DZ')}</strong></p>
            </div>
          </div>

          {/* Stock KPI banner */}
          <div className="grid grid-cols-3 gap-4 border border-black p-4 bg-slate-50 text-xs">
            <div>
              <span className="block text-slate-500 font-bold uppercase text-[9px]">Total Références :</span>
              <strong className="text-base block">{totalArticles} articles</strong>
            </div>
            <div>
              <span className="block text-slate-500 font-bold uppercase text-[9px]">Quantité Totale en Stock :</span>
              <strong className="text-base block">{totalStockQty} unités</strong>
            </div>
            <div className="text-right">
              <span className="block text-slate-500 font-bold uppercase text-[9px]">Valeur Globale de Vente :</span>
              <strong className="text-base block font-black text-black">
                {totalStockValue.toLocaleString('fr-DZ')} DA
              </strong>
            </div>
          </div>

          {/* Stock Table */}
          <table className="w-full text-xs border-collapse border border-black">
            <thead>
              <tr className="bg-slate-100 border-b border-black text-left">
                <th className="border border-black px-2 py-1.5 w-28">Code / Réf</th>
                <th className="border border-black px-2 py-1.5">Désignation</th>
                <th className="border border-black px-2 py-1.5 w-24">Catégorie</th>
                <th className="border border-black px-2 py-1.5 text-right w-20">P.U Achat</th>
                <th className="border border-black px-2 py-1.5 text-right w-24">P.U Vente</th>
                <th className="border border-black px-2 py-1.5 text-center w-20">En Stock</th>
                <th className="border border-black px-2 py-1.5 text-right w-28">Total Vente</th>
              </tr>
            </thead>
            <tbody>
              {safeProducts.map((p, idx) => {
                const qty = Number(p.quantite) || 0;
                const pv = Number(p.prixVente) || 0;
                const lineTotal = qty * pv;
                return (
                  <tr key={p._id || idx} className="border-b border-slate-300">
                    <td className="border border-black px-2 py-1 font-mono text-[11px]">{p.codeBarre || p.reference}</td>
                    <td className="border border-black px-2 py-1 font-bold">{p.nom}</td>
                    <td className="border border-black px-2 py-1">{p.categorie || '-'}</td>
                    <td className="border border-black px-2 py-1 text-right">{Number(p.prixAchat || 0).toLocaleString('fr-DZ')} DA</td>
                    <td className="border border-black px-2 py-1 text-right font-bold">{pv.toLocaleString('fr-DZ')} DA</td>
                    <td className="border border-black px-2 py-1 text-center font-black">{qty} {p.unite || 'pcs'}</td>
                    <td className="border border-black px-2 py-1 text-right font-mono font-bold">{lineTotal.toLocaleString('fr-DZ')} DA</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-black text-xs">
            <div>
              <p className="font-bold">Visa Responsable Stock :</p>
              <div className="h-16 border-b border-dashed border-black mt-2"></div>
            </div>
            <div>
              <p className="font-bold">Cachet & Signature Direction :</p>
              <div className="h-16 border-b border-dashed border-black mt-2"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
