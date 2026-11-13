import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  QrCode, 
  Search, 
  Plus, 
  Trash2, 
  ShoppingCart, 
  User, 
  Printer, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Receipt, 
  RotateCcw, 
  Volume2, 
  VolumeX,
  CreditCard,
  Eye,
  RefreshCw,
  Sparkles,
  RotateCw,
  Pencil,
  FileDown,
  LayoutGrid,
  List,
  Image as ImageIcon,
  Package,
  UserPlus,
  Truck,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin
} from 'lucide-react';
import { api } from '../../services/api';
import SaleReturnModal from '../invoices/SaleReturnModal';
import EditInvoiceModal from '../invoices/EditInvoiceModal';
import CustomerModal from '../customers/CustomerModal';
import CustomerLedgerModal from '../customers/CustomerLedgerModal';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { 
  getPrinterSettings, 
  generateReceiptHtml, 
  generateA4InvoiceHtml, 
  printHtmlContent, 
  decodeAzertyBarcode, 
  exportInvoiceToPdf,
  createBarcodeDataUrl,
  formatCurrencyDz
} from '../../utils/printerHelper';

// Web Audio API Bip Sound on scan (Singleton AudioContext to eliminate sound driver latency)
let cachedAudioCtx = null;
function getAudioContext() {
  try {
    if (!cachedAudioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        cachedAudioCtx = new AudioCtxClass();
      }
    }
    if (cachedAudioCtx && cachedAudioCtx.state === 'suspended') {
      cachedAudioCtx.resume().catch(() => {});
    }
    return cachedAudioCtx;
  } catch (e) {
    return null;
  }
}

function playBeep(type = 'success') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime); // High pleasant pitch
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.10);
      osc.start();
      osc.stop(ctx.currentTime + 0.10);
    } else {
      osc.frequency.setValueAtTime(300, ctx.currentTime); // Low pitch error
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.20);
      osc.start();
      osc.stop(ctx.currentTime + 0.20);
    }
  } catch (e) {
    // Audio context not allowed or supported
  }
}

// Normalisation du texte : suppression des accents, casse insensible, espaces nettoyés
const normalizeSearchText = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// Vérifie si un produit correspond à une recherche textuelle (nom, référence, code-barres, multi-codes, catégorie)
const isProductMatch = (product, query) => {
  if (!product || !query) return false;
  const normQuery = normalizeSearchText(query);
  if (!normQuery) return false;

  const normNom = normalizeSearchText(product.nom);
  const normRef = normalizeSearchText(product.reference);
  const normCode = normalizeSearchText(product.codeBarre);
  const normCat = normalizeSearchText(product.categorie);

  const extraCodes = Array.isArray(product.codesBarres)
    ? product.codesBarres.map((c) => normalizeSearchText(c))
    : [];

  // 1. Correspondance directe simple (début ou inclusion)
  if (
    normNom.includes(normQuery) ||
    normRef.includes(normQuery) ||
    normCode.includes(normQuery) ||
    normCat.includes(normQuery) ||
    extraCodes.some((ec) => ec.includes(normQuery))
  ) {
    return true;
  }

  // 2. Correspondance multi-mots (ex: "huile elio" trouve "Huile de table Elio 5L")
  const words = normQuery.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const fullText = `${normNom} ${normRef} ${normCat} ${normCode} ${extraCodes.join(' ')}`;
    return words.every((w) => fullText.includes(w));
  }

  return false;
};

export default function PosView({ 
  posId = 'pos-1',
  posTitle = 'POS 1',
  caisseId = 'pos-1', 
  caisseTitle = 'POS 1', 
  isActive = true, 
  onOpenNewPos = null, 
  onOpenNewCaisse = null 
}) {
  const { t, isRTL } = useLanguage();
  const { currentUser } = useAuth();
  const displayTitle = posTitle || caisseTitle || 'POS 1';
  const handleCreateNewPos = onOpenNewPos || onOpenNewCaisse;

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [searchedInvoices, setSearchedInvoices] = useState(null);
  
  // Caisses & Pricing Tier State
  const [caisses, setCaisses] = useState([]);
  const [selectedCaisse, setSelectedCaisse] = useState(() => {
    return currentUser?.caisse || localStorage.getItem('commercepost_active_caisse') || 'Caisse 1 (Magasin)';
  });
  const [selectedTarif, setSelectedTarif] = useState('prixVente'); // 'prixVente' | 'prixDemiGros' | 'prixGros' | 'prixSuperGros'

  // Scanner Input State & Fast Lookup References
  const [scanInput, setScanInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const scanInputRef = useRef(null);
  const productsRef = useRef(products);
  productsRef.current = products;
  const selectedTarifRef = useRef(selectedTarif);
  selectedTarifRef.current = selectedTarif;

  // Ultra-fast In-Memory O(1) Barcode/Reference Map
  const productBarcodeMapRef = useRef(new Map());
  const scanStartTimeRef = useRef(null);
  const isProcessingScanRef = useRef(false);
  const scanQueueRef = useRef([]);
  const searchResultsRef = useRef([]);
  const processBarcodeRef = useRef(null);
  const enqueueScanRef = useRef(null);

  // Cart & Sale State
  const [typeDocument, setTypeDocument] = useState('BON_COMMANDE');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [nomClientLibre, setNomClientLibre] = useState(t('pos_counterClient'));
  const [cart, setCart] = useState([]);
  const [tauxTva, setTauxTva] = useState(0);
  const [modePaiement, setModePaiement] = useState('ESPECES');
  const [montantPaye, setMontantPaye] = useState(0);
  const [notes, setNotes] = useState('');

  // Right Panel: Active Order Details or Session History
  const [rightTab, setRightTab] = useState('detail'); // 'detail' | 'history'
  const [activeInvoice, setActiveInvoice] = useState(null);

  // View Mode: 'cart' (tableau classique) ou 'catalog' (grille photos)
  const [posViewMode, setPosViewMode] = useState('cart');
  const [selectedCatalogCategory, setSelectedCatalogCategory] = useState('TOUS');
  const [catalogFilterText, setCatalogFilterText] = useState('');

  // Status, Edit & Return Modal
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [scanQuantity, setScanQuantity] = useState(1);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnInvoice, setReturnInvoice] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isCustomerLedgerOpen, setIsCustomerLedgerOpen] = useState(false);
  const [posReceiptRotation, setPosReceiptRotation] = useState(() => getPrinterSettings().receiptRotation || 0);

  // References pour éliminer tout effet de fermeture périmée (stale closure) dans les raccourcis F1..F6
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const scanQuantityRef = useRef(scanQuantity);
  scanQuantityRef.current = scanQuantity;
  const activeInvoiceRef = useRef(activeInvoice);
  activeInvoiceRef.current = activeInvoice;
  const recentInvoicesRef = useRef(recentInvoices);
  recentInvoicesRef.current = recentInvoices;
  const handleValidateSaleRef = useRef(null);
  const handleOpenEditModalRef = useRef(null);
  const handleOpenReturnModalRef = useRef(null);
  const handleToggleHistoryRef = useRef(null);
  const handleOpenCustomerModalRef = useRef(null);
  const handleSyncProductsRef = useRef(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Resizable Right Panel State (Optimisé pour ordinateurs portables 13 pouces)
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth <= 1366 ? 330 : 420;
  });
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth <= 1180;
  });
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);

  // Dragging event handlers for resizable panels
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingDivider) return;
      const newWidth = isRTL 
        ? e.clientX 
        : window.innerWidth - e.clientX;
      if (newWidth >= 280 && newWidth <= 900) {
        setRightPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
    };

    if (isDraggingDivider) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider, isRTL]);

  // Construction du dictionnaire O(1) en mémoire (préserve le typage String et les zéros initiaux)
  const buildBarcodeMap = (prods) => {
    const map = new Map();
    if (!Array.isArray(prods)) return map;

    const registerCode = (code, p) => {
      if (!code) return;
      const str = String(code).trim();
      if (!str) return;
      map.set(str, p);
      map.set(str.toLowerCase(), p);
      map.set(str.toUpperCase(), p);
      const az = decodeAzertyBarcode(str).trim();
      if (az) {
        map.set(az, p);
        map.set(az.toLowerCase(), p);
        map.set(az.toUpperCase(), p);
      }
    };

    for (let i = 0; i < prods.length; i++) {
      const p = prods[i];
      if (!p) continue;
      // Indexation Code-Barres principal
      if (p.codeBarre) {
        registerCode(p.codeBarre, p);
      }
      // Indexation Référence
      if (p.reference) {
        registerCode(p.reference, p);
      }
      // Indexation Multi-codes-barres secondaires (codesBarres)
      if (p.codesBarres) {
        const extraList = Array.isArray(p.codesBarres)
          ? p.codesBarres
          : String(p.codesBarres).split(/[,;\s\n]+/).map((c) => c.trim()).filter(Boolean);
        for (const ec of extraList) {
          registerCode(ec, p);
        }
      }
    }
    return map;
  };

  // Maintenir l'index synchronisé dès que le catalogue change
  useEffect(() => {
    productsRef.current = products;
    productBarcodeMapRef.current = buildBarcodeMap(products);
  }, [products]);

  // Load initial data
  const loadData = async () => {
    try {
      const [prodRes, custRes, invRes, caisseRes] = await Promise.all([
        api.stock.getAll(),
        api.customer.getAll(),
        // Charger les bons récents (les 50 derniers bons pour ne jamais rater de bon même autour de minuit)
        api.invoice.getAll({ limit: 50 }),
        api.caisse ? api.caisse.getAll() : Promise.resolve({ success: false })
      ]);
      if (prodRes.success) {
        setProducts(prodRes.data);
        productsRef.current = prodRes.data;
        productBarcodeMapRef.current = buildBarcodeMap(prodRes.data);
      }
      if (custRes.success) setCustomers(custRes.data);
      if (invRes.success) {
        setRecentInvoices(invRes.data);
      }
      if (caisseRes.success && caisseRes.data && caisseRes.data.length > 0) {
        setCaisses(caisseRes.data);
        const userCaisse = currentUser?.caisse;
        const saved = localStorage.getItem('commercepost_active_caisse');
        const matchedUser = userCaisse ? caisseRes.data.find(c => c.nom?.toLowerCase() === userCaisse?.toLowerCase()) : null;
        const matched = caisseRes.data.find(c => c.nom?.toLowerCase() === saved?.toLowerCase());
        
        if (matchedUser) {
          setSelectedCaisse(matchedUser.nom);
        } else if (matched) {
          setSelectedCaisse(matched.nom);
        } else if (!selectedCaisse || !caisseRes.data.some(c => c.nom === selectedCaisse)) {
          setSelectedCaisse(caisseRes.data[0].nom);
          localStorage.setItem('commercepost_active_caisse', caisseRes.data[0].nom);
        }
      }
    } catch (e) {
      console.error('Erreur chargement données caisse:', e);
    }
  };

  // Synchronisation temps réel : Recharger dès que l'onglet POS devient actif
  useEffect(() => {
    if (isActive) {
      loadData();
    }
  }, [isActive]);

  // Synchronisation temps réel : Recharger les produits dès qu'une modification survient ailleurs
  useEffect(() => {
    const handleDataChange = () => {
      loadData();
    };
    window.addEventListener('app:refresh-data', handleDataChange);
    return () => window.removeEventListener('app:refresh-data', handleDataChange);
  }, []);

  // Synchronisation et rechargement des produits (Raccourci F7)
  const handleSyncProducts = async () => {
    try {
      setIsSyncing(true);
      showNotification('Synchronisation des produits en cours...', 'info');
      const prodRes = await api.stock.getAll();
      if (prodRes && prodRes.success && Array.isArray(prodRes.data)) {
        setProducts(prodRes.data);
        productsRef.current = prodRes.data;
        productBarcodeMapRef.current = buildBarcodeMap(prodRes.data);
        showNotification(`✅ ${prodRes.data.length} produits synchronisés avec succès (F7) !`, 'success');
        if (soundEnabled) playBeep('success');
      } else {
        showNotification('Échec de la synchronisation des produits.', 'error');
        if (soundEnabled) playBeep('error');
      }
    } catch (err) {
      console.error('Erreur synchronisation produits F7:', err);
      showNotification(`Erreur sync: ${err.message || 'Échec de connexion'}`, 'error');
      if (soundEnabled) playBeep('error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Recherche debouncée dans l'historique des bons (pour retour, BL ou consultation)
  useEffect(() => {
    const q = historySearch.trim();
    if (!q) {
      setSearchedInvoices(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.invoice.getAll({ search: q, limit: 30 });
        if (res.success && Array.isArray(res.data)) {
          setSearchedInvoices(res.data);
        }
      } catch (err) {
        console.error('Erreur recherche bons POS:', err);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [historySearch]);

  const handleResetTicket = () => {
    setCart([]);
    cartRef.current = [];
    setSelectedCustomerId('');
    setNomClientLibre(t('pos_counterClient') || 'Client Comptoir');
    setTypeDocument('BON_COMMANDE');
    setTauxTva(0);
    setModePaiement('ESPECES');
    setMontantPaye(0);
    setNotes('');
    setActiveInvoice(null);
    activeInvoiceRef.current = null;
    setScanInput('');
    if (scanInputRef.current) {
      scanInputRef.current.value = '';
      scanInputRef.current.focus();
    }
    // Recharger immédiatement tous les coordonnées clients, soldes et produits
    loadData();
    showNotification('Nouveau ticket de caisse initialisé.', 'info');
  };

  // Rechargement automatique dès que l'onglet POS s'ouvre ou devient actif
  useEffect(() => {
    if (isActive) {
      loadData();
      if (scanInputRef.current) {
        scanInputRef.current.focus();
      }
    }
  }, [isActive]);

  // Synchronisation inter-vues (actualisation automatique si un client, dette, achat ou produit change ailleurs)
  useEffect(() => {
    const handleRefreshAll = () => {
      if (isActive) {
        loadData();
      }
    };
    window.addEventListener('customer-updated', handleRefreshAll);
    window.addEventListener('stock-updated', handleRefreshAll);
    window.addEventListener('invoice-updated', handleRefreshAll);
    window.addEventListener('supplier-updated', handleRefreshAll);
    window.addEventListener('focus', handleRefreshAll);
    return () => {
      window.removeEventListener('customer-updated', handleRefreshAll);
      window.removeEventListener('stock-updated', handleRefreshAll);
      window.removeEventListener('invoice-updated', handleRefreshAll);
      window.removeEventListener('supplier-updated', handleRefreshAll);
      window.removeEventListener('focus', handleRefreshAll);
    };
  }, [isActive]);

  // Suggestions de recherche instantanées dès la frappe (nom, référence, code-barres, multi-mots, sans accents)
  const searchResults = useMemo(() => {
    const q = scanInput.trim();
    if (!q || q.startsWith('FAC:') || q.startsWith('TCK:') || q.startsWith('BC-')) return [];
    if (/^\d{1,5}\s*[\*xX]$/.test(q)) return []; // Multiplicateur de quantité ("5*")
    return products.filter((p) => isProductMatch(p, q)).slice(0, 8);
  }, [scanInput, products]);

  searchResultsRef.current = searchResults;

  // Catégories disponibles pour le catalogue visuel
  const catalogCategories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.categorie && String(p.categorie).trim()) {
        set.add(String(p.categorie).trim());
      }
    });
    return ['TOUS', ...Array.from(set)];
  }, [products]);

  // Produits filtrés pour la grille catalogue photos
  const filteredCatalogProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCatalogCategory === 'TOUS' || p.categorie === selectedCatalogCategory;
      if (!matchCat) return false;
      if (!catalogFilterText.trim()) return true;
      return isProductMatch(p, catalogFilterText.trim());
    });
  }, [products, selectedCatalogCategory, catalogFilterText]);

  // Quantités par produit dans le panier en temps réel
  const cartItemQuantities = useMemo(() => {
    const map = {};
    cart.forEach((it) => {
      map[it.productId] = (map[it.productId] || 0) + (Number(it.quantite) || 0);
    });
    return map;
  }, [cart]);

  const showNotification = (msg, type = 'success') => {
    if (soundEnabled) playBeep(type);
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Helper to determine price based on selected tariff
  const getProductPrice = (product, tarif = selectedTarif) => {
    if (!product) return 0;
    if (tarif === 'prixSerie' && product.prixSerie && Number(product.prixSerie) > 0) return Number(product.prixSerie);
    if (tarif === 'prixDemiGros' && product.prixDemiGros && Number(product.prixDemiGros) > 0) return Number(product.prixDemiGros);
    if (tarif === 'prixGros' && product.prixGros && Number(product.prixGros) > 0) return Number(product.prixGros);
    if (tarif === 'prixSuperGros' && product.prixSuperGros && Number(product.prixSuperGros) > 0) return Number(product.prixSuperGros);
    return Number(product.prixVente) || 0;
  };

  // Change active tariff and immediately recalculate unit prices for all items in cart
  const handleSelectTarif = (newTarif) => {
    setSelectedTarif(newTarif);
    selectedTarifRef.current = newTarif;

    const prods = productsRef.current || products || [];
    setCart((prevCart) => {
      if (!prevCart || prevCart.length === 0) return prevCart;
      return prevCart.map((item) => {
        const prod = prods.find((p) => (p._id || p.id) === item.productId) || item.product;
        if (!prod) return item;

        const isSerie = newTarif === 'prixSerie' && Boolean(prod.prixSerie && Number(prod.prixSerie) > 0);
        const nextPrice = isSerie ? Number(prod.prixSerie) : getProductPrice(prod, newTarif);

        return {
          ...item,
          prixUnitaire: nextPrice,
          isSerie,
          unite: isSerie ? 'série' : (item.defaultUnite || prod.unite || 'pcs')
        };
      });
    });

    const tarifLabels = {
      prixVente: t('pos_tarif_detail') || 'Détail',
      prixDemiGros: t('pos_tarif_demi') || '½ Gros',
      prixGros: t('pos_tarif_gros') || 'Gros',
      prixSuperGros: t('pos_tarif_super') || 'Super',
      prixSerie: t('pos_tarif_serie') || 'Série'
    };
    showNotification(`Tarif actif : ${tarifLabels[newTarif] || newTarif}`);
  };

  // Basculer un article du panier entre vente Pièce et Série
  const toggleCartItemSerie = (pId, isSerieCurrent) => {
    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.productId === pId && item.isSerie === isSerieCurrent) {
          const nextIsSerie = !item.isSerie;
          const nextUnitPrice = nextIsSerie
            ? (Number(item.prixSerie) > 0 ? Number(item.prixSerie) : item.prixUnitaire)
            : (Number(item.prixPiece) > 0 ? Number(item.prixPiece) : item.prixUnitaire);
          return {
            ...item,
            isSerie: nextIsSerie,
            prixUnitaire: nextUnitPrice,
            unite: nextIsSerie ? 'série' : (item.defaultUnite || 'pcs')
          };
        }
        return item;
      });
    });
  };

  // Add product to cart by product object with quantity
  const addProductToCart = (product, quantityToAdd = 1) => {
    if (!product) return;
    const qtyToAdd = Math.max(1, Number(quantityToAdd) || 1);

    const currentTarif = selectedTarifRef.current || selectedTarif;
    const isSerie = currentTarif === 'prixSerie' && Boolean(product.prixSerie && Number(product.prixSerie) > 0);
    const piecesParSerie = Number(product.piecesParSerie) > 0 ? Number(product.piecesParSerie) : 1;
    const unitPrice = isSerie ? Number(product.prixSerie) : getProductPrice(product, currentTarif);
    const costPrice = Number(product.prixAchat) || 0;

    if (costPrice > 0 && unitPrice < costPrice) {
      showNotification(t('pos_lossSaleAlert') || `Attention: Prix de vente inférieur au prix d'achat (${costPrice} ${t('currency')}) !`, 'error');
    }

    setCart((prevCart) => {
      const pId = product._id || product.id;
      const existingIndex = prevCart.findIndex((item) => item.productId === pId && Boolean(item.isSerie) === isSerie);
      if (existingIndex > -1) {
        const currentItem = prevCart[existingIndex];
        const newQty = currentItem.quantite + qtyToAdd;
        const updated = [...prevCart];
        updated[existingIndex] = { ...currentItem, quantite: newQty };
        return updated;
      } else {
        return [
          ...prevCart,
          {
            productId: pId,
            reference: product.reference,
            nom: product.nom,
            image: product.image || '',
            prixUnitaire: unitPrice,
            prixAchat: costPrice,
            prixPiece: Number(product.prixVente) || 0,
            prixDemiGros: Number(product.prixDemiGros) || 0,
            prixGros: Number(product.prixGros) || 0,
            prixSuperGros: Number(product.prixSuperGros) || 0,
            prixSerie: Number(product.prixSerie) || 0,
            product,
            piecesParSerie,
            isSerie,
            maxStock: Number(product.quantite) || 0,
            unite: isSerie ? 'série' : (product.unite || 'pcs'),
            defaultUnite: product.unite || 'pcs',
            quantite: qtyToAdd
          }
        ];
      }
    });

    const label = isSerie ? `${product.nom} (Série de ${piecesParSerie} pcs)` : product.nom;
    if (Number(product.quantite || 0) <= 0) {
      showNotification(`Ajouté (Stock disponible : 0) : ${label} (+${qtyToAdd})`, 'warning');
    } else {
      showNotification(`Ajouté : ${label} (+${qtyToAdd})`);
    }
  };

  // Helper pour trouver un produit par code dans le catalogue local en O(1)
  const findProductByCode = (codeStr) => {
    if (!codeStr) return null;
    const c = String(codeStr).trim();
    if (!c) return null;

    // 1. Accès immédiat O(1) dans la table de hachage
    const map = productBarcodeMapRef.current;
    if (map && map.size > 0) {
      let p = map.get(c) || map.get(c.toLowerCase()) || map.get(c.toUpperCase());
      if (p) return p;
      const azerty = decodeAzertyBarcode(c).trim();
      if (azerty) {
        p = map.get(azerty) || map.get(azerty.toLowerCase()) || map.get(azerty.toUpperCase());
        if (p) return p;
      }
    }

    // 2. Fallback linéaire si non indexé
    const currentProds = productsRef.current || products;
    const azerty = decodeAzertyBarcode(c).trim();
    const keys = Array.from(new Set([c.toLowerCase(), azerty.toLowerCase(), c, azerty])).filter(Boolean);
    return currentProds.find((p) => {
      const pCode = (p.codeBarre || '').trim().toLowerCase();
      const pRef = (p.reference || '').trim().toLowerCase();
      return keys.includes(pCode) || keys.includes(pRef);
    });
  };

  // Traitement universel d'un code scanné avec métriques de performance et gestion de queue
  const executeScanProcess = async (rawCode, t0 = performance.now(), t1 = performance.now()) => {
    const t2 = performance.now(); // Début de recherche
    // Nettoyage strict : suppression \r, \n et caractères de contrôle invisibles
    // Préservation absolue du type chaîne de caractères et des zéros initiaux (ex: "0086")
    let raw = String(rawCode || '').replace(/[\r\n\x00-\x1F\x7F]/g, '').trim();
    if (!raw) return;

    let qtyForThis = (scanQuantityRef.current && scanQuantityRef.current > 1) 
      ? scanQuantityRef.current 
      : (scanQuantity > 1 ? scanQuantity : 1);

    // A. Détecter un séparateur de quantité explicite : ex "5*681400", "12x681400", "3 681400", "5-681400", "10#681400"
    const sepMatch = raw.match(/^(\d{1,5})\s*[\*xX\s\-_#]\s*(.+)$/);
    if (sepMatch) {
      qtyForThis = parseInt(sepMatch[1], 10) || 1;
      raw = sepMatch[2].trim();
    }

    // 1. Détection intelligente de scan de Bon ou Facture par la douchette (ex: BC2026100349, BC-..., FAC..., TCK..., ou ID)
    const azertyDecoded = decodeAzertyBarcode(raw).trim();
    const isDocCode = (str) => {
      const u = String(str || '').toUpperCase();
      return u.startsWith('BC') || u.startsWith('FAC') || u.startsWith('TCK') || u.startsWith('BL') || u.startsWith('BON');
    };

    if (isDocCode(raw) || isDocCode(azertyDecoded)) {
      const candidateDocCode = isDocCode(raw) ? raw : azertyDecoded;
      try {
        const invRes = await api.invoice.getById(candidateDocCode);
        if (invRes && invRes.success && invRes.data) {
          setActiveInvoice(invRes.data);
          setRightTab('detail');
          showNotification(`★ Document ${invRes.data.numeroFacture} chargé avec succès.`);
          if (soundEnabled) playBeep('success');
          setScanInput('');
          setScanQuantity(1);
          scanQuantityRef.current = 1;
          if (scanInputRef.current) scanInputRef.current.value = '';
          return;
        }
      } catch (err) {
        console.error('Erreur scan bon direct:', err);
      }
    }

    // B. Test direct ultra-rapide en mémoire vive O(1) pour code-barres / référence
    let matchedProduct = findProductByCode(raw);

    // B2. Si non trouvé par code-barres, chercher immédiatement par nom / désignation
    if (!matchedProduct) {
      const currentProds = productsRef.current || products;
      if (searchResultsRef.current && searchResultsRef.current.length > 0) {
        matchedProduct = searchResultsRef.current[0];
      } else {
        matchedProduct = currentProds.find((p) => isProductMatch(p, raw));
      }
    }

    // C. Si NON trouvé directement et sans séparateur explicite :
    // L'utilisateur a tapé le numéro (ex: 5) puis scanné le code-barres (ex: 613000...) sans espace ni étoile !
    // Ce qui donne dans le champ: "5613000..."
    // On teste le retrait de 1, 2, 3 ou 4 chiffres du début pour trouver l'article correspondant
    if (!matchedProduct && !sepMatch && raw.length >= 5) {
      for (let prefixLen = 1; prefixLen <= 4 && prefixLen <= raw.length - 3; prefixLen++) {
        const candidateQtyStr = raw.slice(0, prefixLen);
        const candidateCode = raw.slice(prefixLen);
        const candidateQty = parseInt(candidateQtyStr, 10);
        if (candidateQty > 0) {
          const testProd = findProductByCode(candidateCode) || (productsRef.current || products).find((p) => isProductMatch(p, candidateCode));
          if (testProd) {
            matchedProduct = testProd;
            qtyForThis = candidateQty;
            raw = candidateCode;
            break;
          }
        }
      }
    }

    const t3 = performance.now(); // Résultat recherche trouvé

    if (matchedProduct) {
      addProductToCart(matchedProduct, qtyForThis);
      const t4 = performance.now(); // Ajout au panier effectué
      console.log(`[SCAN-PERF] Saisie->ENTER: ${(t1 - t0).toFixed(1)}ms | Recherche (Mémoire O(1)): ${(t3 - t2).toFixed(2)}ms | Ajout Panier: ${(t4 - t3).toFixed(1)}ms | TOTAL: ${(t4 - t0).toFixed(1)}ms - Produit: "${matchedProduct.nom}"`);
      setScanQuantity(1);
      scanQuantityRef.current = 1;
      setScanInput('');
      if (scanInputRef.current) scanInputRef.current.value = '';
      return;
    }

    // 2. Recherche au niveau du backend SQLite (avec code direct ou décodé AZERTY sur index B-Tree)
    const clean = raw.trim();
    const azertyDecodedClean = decodeAzertyBarcode(clean).trim();
    let prodRes = await api.stock.getByRefOrId(clean);
    if ((!prodRes.success || !prodRes.data) && azertyDecodedClean !== clean) {
      prodRes = await api.stock.getByRefOrId(azertyDecodedClean);
    }

    // Si pas trouvé au backend et sans séparateur, tester découpage au niveau backend
    if ((!prodRes || !prodRes.success || !prodRes.data) && !sepMatch && raw.length >= 5) {
      for (let prefixLen = 1; prefixLen <= 4 && prefixLen <= raw.length - 3; prefixLen++) {
        const candidateQtyStr = raw.slice(0, prefixLen);
        const candidateCode = raw.slice(prefixLen);
        const candidateQty = parseInt(candidateQtyStr, 10);
        if (candidateQty > 0) {
          const bRes = await api.stock.getByRefOrId(candidateCode);
          if (bRes && bRes.success && bRes.data) {
            prodRes = bRes;
            qtyForThis = candidateQty;
            break;
          }
        }
      }
    }

    const t3Db = performance.now();

    if (prodRes && prodRes.success && prodRes.data) {
      // Mettre en cache dans la Map mémoire pour les futurs scans immédiats
      if (prodRes.data.codeBarre) {
        productBarcodeMapRef.current.set(String(prodRes.data.codeBarre).trim(), prodRes.data);
      }
      addProductToCart(prodRes.data, qtyForThis);
      const t4 = performance.now();
      console.log(`[SCAN-PERF] Saisie->ENTER: ${(t1 - t0).toFixed(1)}ms | Recherche (SQLite Index): ${(t3Db - t2).toFixed(2)}ms | Ajout Panier: ${(t4 - t3Db).toFixed(1)}ms | TOTAL: ${(t4 - t0).toFixed(1)}ms - Produit: "${prodRes.data.nom}"`);
      setScanQuantity(1);
      scanQuantityRef.current = 1;
      setScanInput('');
      if (scanInputRef.current) scanInputRef.current.value = '';
      return;
    }

    // 3. Recherche par nom ou désignation en dernier recours (avec normalisation multi-mots)
    const currentProds = productsRef.current || products;
    const nameMatch = currentProds.find((p) => isProductMatch(p, clean));

    if (nameMatch) {
      addProductToCart(nameMatch, qtyForThis);
      const t4 = performance.now();
      console.log(`[SCAN-PERF] Saisie->ENTER: ${(t1 - t0).toFixed(1)}ms | Recherche (Nom Fallback): ${(t4 - t2).toFixed(2)}ms | TOTAL: ${(t4 - t0).toFixed(1)}ms - Article: "${nameMatch.nom}"`);
      setScanQuantity(1);
      scanQuantityRef.current = 1;
      setScanInput('');
      if (scanInputRef.current) scanInputRef.current.value = '';
    } else {
      // 4. Dernier recours : vérifier s'il s'agit d'un bon / facture scanné par son ID ou code
      try {
        const docRes = await api.invoice.getById(clean);
        if (docRes && docRes.success && docRes.data) {
          setActiveInvoice(docRes.data);
          setRightTab('detail');
          showNotification(`★ Document ${docRes.data.numeroFacture} chargé avec succès.`);
          if (soundEnabled) playBeep('success');
          setScanQuantity(1);
          scanQuantityRef.current = 1;
          setScanInput('');
          if (scanInputRef.current) scanInputRef.current.value = '';
          return;
        }
      } catch (e) {}

      showNotification(`Aucun article ni document trouvé pour : "${rawCode}"`, 'error');
    }
  };

  // Queue FIFO anti-concurrence pour scans en rafale ultra-rapides
  const enqueueScan = (rawCode, t0 = performance.now(), t1 = performance.now()) => {
    scanQueueRef.current.push({ rawCode, t0, t1 });
    drainScanQueue();
  };

  const drainScanQueue = async () => {
    if (isProcessingScanRef.current) return;
    if (scanQueueRef.current.length === 0) return;

    isProcessingScanRef.current = true;
    try {
      while (scanQueueRef.current.length > 0) {
        const item = scanQueueRef.current.shift();
        await executeScanProcess(item.rawCode, item.t0, item.t1);
      }
    } finally {
      isProcessingScanRef.current = false;
    }
  };

  processBarcodeRef.current = executeScanProcess;
  enqueueScanRef.current = enqueueScan;

  // Handle Scan Submit (from barcode/QR scanner or manual input + Enter)
  const handleScanSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const raw = scanInputRef.current ? scanInputRef.current.value.trim() : scanInput.trim();
    if (!raw) return;
    const t1 = performance.now();
    const t0 = scanStartTimeRef.current || (t1 - 10);
    scanStartTimeRef.current = null;
    setScanInput('');
    if (scanInputRef.current) scanInputRef.current.value = '';
    enqueueScan(raw, t0, t1);
  };

  // Traitement intelligent de la saisie utilisateur (ex: taper "5*" ou "3x" fixe immédiatement la quantité)
  const handleScanInputChange = (e) => {
    if (!scanStartTimeRef.current) {
      scanStartTimeRef.current = performance.now();
    }
    const val = e.target.value;

    // Si l'utilisateur tape un multiplicateur : "5*", "12*", "3x", "4X"
    const starMatch = val.match(/^(\d{1,5})\s*[\*xX]$/);
    if (starMatch) {
      const q = parseInt(starMatch[1], 10);
      if (q > 0) {
        setScanQuantity(q);
        scanQuantityRef.current = q;
        setScanInput('');
        if (scanInputRef.current) scanInputRef.current.value = '';
        if (soundEnabled) playBeep('success');
        showNotification(`Quantité fixée à ${q} pcs. Scannez le code-barres...`, 'info');
        scanStartTimeRef.current = null;
        return;
      }
    }

    setScanInput(val);
  };

  // Auto-focus sur le champ scanner lorsque cette caisse devient active
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        if (scanInputRef.current) {
          scanInputRef.current.focus();
        }
      }, 70);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  // Écouteur global pour scanner de code-barres (douchette) et raccourcis F1..F5
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;
    let isFastSequence = false;

    const handleGlobalKeyDown = (e) => {
      // Ignorer tous les événements si cette caisse n'est pas l'onglet actif
      if (!isActive) return;

      // Ne pas intercepter si une modale est ouverte (caisse, stock, client, paramètres, etc.)
      if (
        isReturnModalOpen || 
        isEditModalOpen || 
        isCustomerModalOpen ||
        document.querySelector('.modal-content') ||
        document.querySelector('.modal-container') ||
        document.querySelector('.modal-backdrop') ||
        document.querySelector('[role="dialog"]')
      ) return;

      const activeEl = document.activeElement;
      const isScanInput = activeEl === scanInputRef.current;
      const isOtherEditable = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.isContentEditable
      ) && !isScanInput;

      const now = Date.now();
      const diff = now - lastKeyTime;
      lastKeyTime = now;

      // Si le délai entre deux frappes dépasse 350ms, réinitialiser (pas une douchette en continu)
      if (diff > 350) {
        buffer = '';
        isFastSequence = false;
      } else if (diff < 120) {
        // Fréquence typique d'une douchette matérielle (< 120ms par touche)
        isFastSequence = true;
      }

      // Raccourcis POS : F1, F2, F3, F4, F5, F6 (Utilisation des refs pour éliminer toute fermeture périmée)
      if (e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        if (handleValidateSaleRef.current) {
          handleValidateSaleRef.current(false);
        }
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        if (handleValidateSaleRef.current) {
          handleValidateSaleRef.current(true);
        }
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        e.stopPropagation();
        if (handleOpenEditModalRef.current) {
          handleOpenEditModalRef.current();
        }
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        e.stopPropagation();
        if (handleToggleHistoryRef.current) {
          handleToggleHistoryRef.current();
        }
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
        if (handleCreateNewPos) {
          handleCreateNewPos();
        }
        return;
      }
      if (e.key === 'F6') {
        e.preventDefault();
        e.stopPropagation();
        if (handleOpenCustomerModalRef.current) {
          handleOpenCustomerModalRef.current();
        }
        return;
      }
      if (e.key === 'F7') {
        e.preventDefault();
        e.stopPropagation();
        if (handleSyncProductsRef.current) {
          handleSyncProductsRef.current();
        }
        return;
      }

      // La touche Entrée signale la fin de lecture du scanner
      if (e.key === 'Enter') {
        const inputVal = scanInputRef.current ? scanInputRef.current.value.trim() : scanInput.trim();
        const bufVal = buffer.trim();
        let barcodeToProcess = '';

        // Si l'utilisateur avait tapé un préfixe de quantité (ex: "5*", "5x", ou "5") dans l'input
        // et que la douchette a envoyé le code dans le buffer
        const inputStarMatch = inputVal.match(/^(\d{1,5})\s*[\*xX]$/);
        const inputNumOnly = inputVal.match(/^(\d{1,5})$/);

        if (inputStarMatch && bufVal && bufVal !== inputVal) {
          barcodeToProcess = `${inputStarMatch[1]}*${bufVal}`;
        } else if (inputNumOnly && bufVal && bufVal !== inputVal && !bufVal.startsWith(inputNumOnly[1])) {
          barcodeToProcess = `${inputNumOnly[1]}*${bufVal}`;
        } else {
          // Si l'input contient déjà la combinaison complète (ex: "5*613000..." ou "5613000...")
          // ou le buffer contient le code scanné
          barcodeToProcess = (isScanInput && inputVal) ? inputVal : (bufVal || inputVal);
        }

        barcodeToProcess = barcodeToProcess.trim();

        // Si un code a été accumulé ou présent dans le champ scanner
        if (barcodeToProcess.length >= 1 && (!isOtherEditable || isFastSequence || isScanInput)) {
          e.preventDefault();
          e.stopPropagation();
          const t1 = performance.now();
          const t0 = scanStartTimeRef.current || (t1 - 50);
          scanStartTimeRef.current = null;
          buffer = '';
          isFastSequence = false;
          setScanInput('');
          if (scanInputRef.current) scanInputRef.current.value = '';

          if (enqueueScanRef.current) {
            enqueueScanRef.current(barcodeToProcess, t0, t1);
          } else if (processBarcodeRef.current) {
            processBarcodeRef.current(barcodeToProcess, t0, t1);
          }

          // Remettre le focus sur l'input du scanner
          if (scanInputRef.current) {
            scanInputRef.current.focus();
          }
          return;
        }

        buffer = '';
        isFastSequence = false;
        return;
      }

      // Accumuler les caractères alphanumériques et symboles envoyés par le scanner
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (!scanStartTimeRef.current) {
          scanStartTimeRef.current = performance.now();
        }
        buffer += e.key;

        // Si le focus n'est dans aucun champ de saisie
        if (!isScanInput && !isOtherEditable) {
          // Éviter que l'espace ne fasse défiler la page
          if (e.key === ' ' || e.key === '/') {
            e.preventDefault();
          }
        }
      }
    };

    // Recentrer le focus sur l'input quand l'utilisateur clique sur la page (hors boutons / inputs)
    const handleDocumentClick = (e) => {
      if (!isActive) return;
      const target = e.target;
      if (!target) return;
      if (
        document.querySelector('.modal-content') ||
        document.querySelector('.modal-container') ||
        document.querySelector('.modal-backdrop') ||
        document.querySelector('[role="dialog"]') ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'BUTTON' ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('textarea') ||
        target.closest('.modal-content') ||
        target.closest('.modal-container') ||
        target.closest('.modal-backdrop') ||
        target.closest('[role="dialog"]')
      ) {
        return;
      }
      if (scanInputRef.current) {
        scanInputRef.current.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    document.addEventListener('click', handleDocumentClick);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [isReturnModalOpen, isEditModalOpen, isCustomerModalOpen, isActive]);

  const updateCartQuantity = (productId, newQty) => {
    const item = cart.find((i) => i.productId === productId);
    if (!item) return;

    if (newQty === '' || newQty === '-') {
      setCart(cart.map((i) => i.productId === productId ? { ...i, quantite: newQty } : i));
      return;
    }

    const val = Math.round(Number(newQty) * 1000) / 1000;
    if (isNaN(val)) return;

    if (val === 0) {
      removeFromCart(productId);
      return;
    }

    if (val > 0 && item.maxStock > 0 && val > item.maxStock) {
      showNotification(`Attention: Stock dépassé (max ${item.maxStock} ${item.unite}). Vente maintenue.`, 'warning');
    }

    setCart(
      cart.map((i) =>
        i.productId === productId ? { ...i, quantite: val } : i
      )
    );
  };

  const updateCartPrice = (productId, newPrice) => {
    setCart(
      cart.map((i) =>
        i.productId === productId ? { ...i, prixUnitaire: Number(newPrice) } : i
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((i) => i.productId !== productId));
  };

  // Calculations
  const totalHT = cart.reduce((sum, item) => sum + item.prixUnitaire * item.quantite, 0);
  const montantTva = Math.round((totalHT * (tauxTva / 100)) * 100) / 100;
  const totalTTC = Math.round((totalHT + montantTva) * 100) / 100;

  useEffect(() => {
    if (modePaiement === 'A_CREDIT') {
      setMontantPaye(0);
    } else {
      setMontantPaye(totalTTC);
    }
  }, [totalTTC, modePaiement]);

  const montantReste = Math.max(0, Math.round((totalTTC - montantPaye) * 100) / 100);

  // Ouvrir la modale de modification d'un bon (F3)
  const handleOpenEditModal = (invTarget) => {
    const inv = invTarget || activeInvoiceRef.current || (recentInvoicesRef.current && recentInvoicesRef.current[0]);
    if (inv) {
      setInvoiceToEdit(inv);
      setIsEditModalOpen(true);
    } else {
      showNotification('Veuillez sélectionner un bon dans l\'historique.', 'error');
    }
  };

  // Ouvrir/Basculer sur l'historique des ventes (F4)
  const toggleHistoryPanel = () => {
    setIsRightPanelCollapsed(false);
    setRightTab('history');
    if (rightPanelWidth < 340) {
      setRightPanelWidth(360);
    }
    loadData();
  };

  // Ouvrir la modale de retour d'un bon
  const handleOpenReturnModal = (invTarget) => {
    const inv = invTarget || activeInvoiceRef.current || (recentInvoicesRef.current && recentInvoicesRef.current[0]);
    if (inv) {
      setReturnInvoice(inv);
      setIsReturnModalOpen(true);
    } else {
      showNotification('Veuillez sélectionner un bon pour effectuer un retour.', 'error');
    }
  };

  // Ouvrir la modale d'ajout d'un nouveau client (F6)
  const handleOpenCustomerModal = () => {
    setIsCustomerModalOpen(true);
  };

  // Callback après enregistrement du nouveau client
  const handleCustomerSaved = async (newCustomer) => {
    try {
      const custRes = await api.customer.getAll();
      if (custRes.success) {
        setCustomers(custRes.data || []);
      }
      if (newCustomer?._id) {
        setSelectedCustomerId(newCustomer._id);
        setNomClientLibre(newCustomer.nom || '');
      }
      showNotification(`Client "${newCustomer?.nom || ''}" ajouté et sélectionné.`, 'success');
    } catch (err) {
      console.error('Erreur mise à jour clients:', err);
    }
  };

  // Validate Sale (F1: Sans impression, F2: Avec impression automatique)
  const handleValidateSale = async (shouldPrint = false) => {
    const currentCart = (cartRef.current && cartRef.current.length > 0) ? cartRef.current : cart;
    if (currentCart.length === 0) {
      showNotification('Le panier est vide. Scannez un article pour commencer.', 'error');
      return;
    }

    if (montantReste > 0 && !selectedCustomerId) {
      showNotification('Pour une vente à crédit, veuillez sélectionner un client enregistré.', 'error');
      return;
    }

    // Check if any product is sold below cost (applicable uniquement aux ventes positives, pas aux retours négatifs)
    const belowCostItems = currentCart.filter(item => {
      const pa = Number(item.prixAchat || item.prixAchatUnitaire || 0);
      return Number(item.quantite) > 0 && pa > 0 && Number(item.prixUnitaire) < pa;
    });
    if (belowCostItems.length > 0) {
      const names = belowCostItems.map(i => {
        const pa = Number(i.prixAchat || i.prixAchatUnitaire || 0);
        return `${i.nom} (${i.prixUnitaire} < ${pa})`;
      }).join(', ');
      const confirmSale = window.confirm(
        `ALERTE PRIX D'ACHAT :\nLes articles suivants sont vendus à un prix inférieur à leur prix d'achat :\n${names}\n\nConfirmez-vous cette vente à perte ?`
      );
      if (!confirmSale) return;
    }

    const cartToSave = [...currentCart];
    try {
      setLoading(true);
      const res = await api.invoice.create({
        typeDocument,
        caisse: selectedCaisse,
        clientId: selectedCustomerId || null,
        nomClientLibre: selectedCustomerId ? undefined : nomClientLibre,
        items: cartToSave,
        tauxTva,
        montantPaye: Number(montantPaye),
        modePaiement,
        notes,
        vendeur: currentUser?.nom || currentUser?.username || 'ILYES',
        caissier: currentUser?.nom || currentUser?.username || 'ILYES',
        creePar: currentUser?.nom || currentUser?.username || 'ILYES'
      });

      if (res.success) {
        showNotification(`★ Vente ${res.data.numeroFacture} validée avec succès ! Le bon de commande est prêt.`);
        const invoiceData = {
          ...res.data,
          nomClientLibre: res.data.nomClientLibre || res.data.clientLibre || nomClientLibre,
          clientLibre: res.data.clientLibre || res.data.nomClientLibre || nomClientLibre,
          items: (res.data.items && Array.isArray(res.data.items) && res.data.items.length > 0) ? res.data.items : cartToSave
        };
        setActiveInvoice(invoiceData);
        activeInvoiceRef.current = invoiceData;
        setRecentInvoices((prev) => [invoiceData, ...(Array.isArray(prev) ? prev.filter((i) => (i.id || i._id) !== (invoiceData.id || invoiceData._id)) : [])]);
        setRightTab('detail');
        setCart([]);
        cartRef.current = [];
        setNotes('');
        await loadData();

        // Notifier immédiatement toutes les autres vues (Tableau de bord, Stock, Mouvements) en temps réel
        window.dispatchEvent(new CustomEvent('app:refresh-data', { detail: { type: 'sale', invoice: invoiceData } }));

        if (shouldPrint) {
          try {
            const settings = getPrinterSettings();
            const html = generateReceiptHtml({
              invoice: invoiceData,
              docType: invoiceData.typeDocument || 'BON_COMMANDE',
              settings,
              rotation: settings.receiptRotation || 0,
              marginLeft: settings.receiptMarginLeft !== undefined ? settings.receiptMarginLeft : 0,
              contentWidth: settings.receiptContentWidth || 80
            });
            const printRes = await printHtmlContent(html, {
              printerName: settings.receiptPrinter,
              pageSize: { width: (settings.receiptPaperWidth === '58mm' ? 58 : 80) * 1000, height: 297000 },
              landscape: settings.receiptOrientation === 'landscape',
              silent: settings.silentPrint !== undefined ? settings.silentPrint : true,
              margins: { marginType: 'none' }
            });
            if (printRes && printRes.success) {
              showNotification('Bon de commande envoyé directement à l\'imprimante !');
            } else {
              showNotification('Bon envoyé à l\'impression.');
            }
          } catch (pe) {
            console.error('Erreur impression:', pe);
            showNotification('Bon envoyé à l\'impression.');
          }
        }
      } else {
        showNotification(res.error || 'Erreur validation vente.', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintActiveInvoice = async (invoiceParam) => {
    let invoiceToPrint = invoiceParam || activeInvoiceRef.current || activeInvoice;
    if (!invoiceToPrint) {
      const currentCart = cartRef.current || cart;
      if (currentCart.length > 0) {
        await handleValidateSale(true);
        return;
      }
      showNotification('Aucun bon de commande sélectionné.', 'error');
      return;
    }

    try {
      const settings = getPrinterSettings();
      const html = generateReceiptHtml({
        invoice: invoiceToPrint,
        docType: invoiceToPrint.typeDocument || 'BON_COMMANDE',
        settings,
        rotation: posReceiptRotation || settings.receiptRotation || 0,
        marginLeft: settings.receiptMarginLeft !== undefined ? settings.receiptMarginLeft : 0,
        contentWidth: settings.receiptContentWidth || 80
      });
      await printHtmlContent(html, {
        printerName: settings.receiptPrinter,
        pageSize: { width: (settings.receiptPaperWidth === '58mm' ? 58 : 80) * 1000, height: 297000 },
        landscape: settings.receiptOrientation === 'landscape',
        silent: true,
        margins: { marginType: 'none' }
      });
      showNotification('Bon de commande envoyé directement à l\'imprimante !');
    } catch (e) {
      showNotification('Bon envoyé à l\'impression.');
    }
  };

  const handlePrintSprt80 = async (invoiceParam) => {
    let invoiceToPrint = invoiceParam || activeInvoiceRef.current || activeInvoice;
    if (!invoiceToPrint) {
      const currentCart = cartRef.current || cart;
      if (currentCart.length > 0) {
        await handleValidateSale(true);
        return;
      }
      showNotification('Aucun bon de commande sélectionné ou panier vide.', 'error');
      return;
    }

    try {
      const settings = getPrinterSettings();
      const html = generateReceiptHtml({
        invoice: invoiceToPrint,
        docType: invoiceToPrint.typeDocument || 'BON_COMMANDE',
        settings,
        rotation: posReceiptRotation || settings.receiptRotation || 0,
        marginLeft: settings.receiptMarginLeft !== undefined ? settings.receiptMarginLeft : 0,
        contentWidth: settings.receiptContentWidth || 80
      });
      await printHtmlContent(html, {
        printerName: settings.receiptPrinter,
        pageSize: { width: (settings.receiptPaperWidth === '58mm' ? 58 : 80) * 1000, height: 297000 },
        landscape: settings.receiptOrientation === 'landscape',
        silent: true,
        margins: { marginType: 'none' }
      });
      showNotification('Bon de commande envoyé directement à l\'imprimante !');
    } catch (e) {
      showNotification('Bon envoyé à l\'impression.');
    }
  };

  const handlePrintA4 = async (invoiceParam) => {
    let invoiceToPrint = invoiceParam || activeInvoiceRef.current || activeInvoice;
    if (!invoiceToPrint) {
      const currentCart = cartRef.current || cart;
      if (currentCart.length > 0) {
        await handleValidateSale(true);
        return;
      }
      showNotification('Aucun bon de commande sélectionné ou panier vide.', 'error');
      return;
    }

    try {
      const settings = getPrinterSettings();
      const html = generateA4InvoiceHtml(invoiceToPrint, settings);
      showNotification('Impression directe Format A4...');
      const res = await printHtmlContent(html, {
        printerName: '',
        pageSize: 'A4',
        landscape: false,
        silent: settings.silentPrint !== false
      });
      if (res.success) {
        showNotification('Facture A4 imprimée avec succès !');
      }
    } catch (e) {
      showNotification(`Erreur impression A4: ${e.message}`, 'error');
    }
  };

  const handlePrintWithoutSaving = async () => {
    const currentCart = cartRef.current || cart;
    if (currentCart.length === 0) {
      showNotification('Le panier est vide pour une impression.', 'error');
      return;
    }

    try {
      const settings = getPrinterSettings();
      const tempInvoice = {
        numeroFacture: `PROV-${Date.now().toString().slice(-4)}`,
        typeDocument: typeDocument || 'BON_COMMANDE',
        createdAt: new Date().toISOString(),
        client: selectedCustomerId ? customers.find(c => (c._id || c.id) === selectedCustomerId) : null,
        nomClientLibre: selectedCustomerId ? undefined : (nomClientLibre || 'Client Comptoir'),
        clientLibre: selectedCustomerId ? undefined : (nomClientLibre || 'Client Comptoir'),
        items: currentCart,
        totalHT,
        totalTTC,
        tauxTva,
        montantPaye: Number(montantPaye) || 0,
        montantReste: Number(montantReste) || 0,
        modePaiement,
        caisse: selectedCaisse,
        vendeur: currentUser?.nom || currentUser?.username || 'ILYES'
      };

      const html = generateReceiptHtml({
        invoice: tempInvoice,
        docType: tempInvoice.typeDocument,
        settings,
        rotation: posReceiptRotation || settings.receiptRotation || 0,
        marginLeft: settings.receiptMarginLeft !== undefined ? settings.receiptMarginLeft : 0,
        contentWidth: settings.receiptContentWidth || 80
      });

      await printHtmlContent(html, {
        printerName: settings.receiptPrinter,
        pageSize: { width: (settings.receiptPaperWidth === '58mm' ? 58 : 80) * 1000, height: 297000 },
        landscape: settings.receiptOrientation === 'landscape',
        silent: true,
        margins: { marginType: 'none' }
      });

      showNotification('★ Bon imprimé directement (sans enregistrement en base ni déstockage).');
    } catch (e) {
      showNotification(`Erreur impression: ${e.message}`, 'error');
    }
  };

  const handleExportPdf = async (invoiceParam) => {
    let invoiceToExport = invoiceParam || activeInvoiceRef.current || activeInvoice;
    if (!invoiceToExport) {
      const currentCart = cartRef.current || cart;
      if (currentCart.length > 0) {
        showNotification('Veuillez d\'abord valider la vente pour exporter son bon en PDF.', 'warning');
        return;
      }
      showNotification('Aucun bon de commande sélectionné pour l\'export PDF.', 'error');
      return;
    }

    try {
      showNotification('Génération du fichier PDF...');
      const res = await exportInvoiceToPdf(invoiceToExport, { format: 'A4' });
      if (res.canceled) return;

      if (res.success) {
        showNotification('Document exporté en PDF avec succès !', 'success');
      } else {
        showNotification(`Erreur export PDF: ${res.error || 'Échec de la génération'}`, 'error');
      }
    } catch (e) {
      showNotification(`Erreur export PDF: ${e.message}`, 'error');
    }
  };

  // Synchronisation des refs pour les raccourcis F1..F7
  handleValidateSaleRef.current = handleValidateSale;
  handleOpenEditModalRef.current = handleOpenEditModal;
  handleOpenReturnModalRef.current = handleOpenReturnModal;
  handleToggleHistoryRef.current = toggleHistoryPanel;
  handleOpenCustomerModalRef.current = handleOpenCustomerModal;
  handleSyncProductsRef.current = handleSyncProducts;

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 bg-slate-100 overflow-hidden select-none">
      {/* LEFT PANEL: POS SCANNER & ACTIVE CART */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 bg-white overflow-hidden h-full">
        {/* Top Scanner Bar (Compact 13" optimized) */}
        <div 
          className="pos-scanner-bar px-3 py-2 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0"
          style={{
            backgroundColor: 'var(--sidebar-bg, #0f172a)'
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              <ShoppingCart className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xs text-white tracking-tight">{displayTitle}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  En service
                </span>
                {handleCreateNewPos && (
                  <button
                    type="button"
                    onClick={handleCreateNewPos}
                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 underline cursor-pointer ml-1"
                    title="Ouvrir un nouveau POS / Panier en simultané (Raccourci: Touche F5)"
                  >
                    + POS (F5)
                  </button>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block">
                {t('pos_scannerSubtitle') || 'Douchette code-barres / Tapez numéro puis scannez'}
              </span>
            </div>
          </div>

          {/* Scanner Input with auto-focus and Quantity Multiplier */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Multiplier / Quantité avant scan */}
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 shrink-0">
              <span className="text-[10px] font-black text-amber-400">Qté:</span>
              <input
                type="number"
                min="1"
                step="1"
                value={scanQuantity}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                  setScanQuantity(val);
                  scanQuantityRef.current = val;
                }}
                className="w-10 text-center text-xs font-black text-white bg-slate-900 border border-slate-600 rounded py-0.5 focus:border-amber-500 focus:outline-hidden"
                title="Saisir la quantité à appliquer au prochain scan"
              />
              <div className="flex gap-0.5">
                {[1, 2, 3, 5, 10, 12].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setScanQuantity(q);
                      scanQuantityRef.current = q;
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-black transition cursor-pointer ${
                      scanQuantity === q
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    }`}
                  >
                    x{q}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative w-56 sm:w-64">
              <form onSubmit={handleScanSubmit} className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={scanInput}
                    onChange={handleScanInputChange}
                    placeholder="Tapez 5* ou N° puis scannez..."
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-white placeholder-slate-400 focus:bg-slate-950 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-1.5 rounded-lg border transition cursor-pointer ${
                    soundEnabled 
                      ? 'bg-slate-800 border-slate-700 text-emerald-400' 
                      : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}
                  title={soundEnabled ? t('pos_soundOn') : t('pos_soundOff')}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </form>

              {/* Notice quantité active */}
              {scanQuantity > 1 && (
                <div className="absolute -bottom-5 left-1 text-[10px] font-black text-amber-400 animate-pulse flex items-center gap-1 z-10">
                  <span>⚡ Quantité prochaine vente : {scanQuantity} pcs (réinitialise à 1 après scan)</span>
                </div>
              )}

              {/* Live Autocomplete Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-30 divide-y divide-slate-800 max-h-64 overflow-y-auto">
                  {searchResults.map((p) => (
                    <div
                      key={p._id || p.id || p.reference}
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={() => {
                        addProductToCart(p, scanQuantity);
                        setScanQuantity(1);
                        setScanInput('');
                        if (scanInputRef.current) scanInputRef.current.focus();
                      }}
                      className="p-2 flex items-center justify-between hover:bg-slate-800/90 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.nom}
                            className="w-8 h-8 object-cover rounded-lg border border-slate-700 bg-slate-800 shrink-0 shadow-2xs"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                            <Package className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-bold text-white block">{p.nom}</span>
                          <span className="text-[10px] text-slate-400">{t('ref')}: {p.reference} • {t('pos_stockAvailable')}: {p.quantite} {p.unite}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-emerald-400">
                          {Number(getProductPrice(p)).toLocaleString('fr-DZ')} {t('currency')}
                          {selectedTarif === 'prixSerie' && p.prixSerie > 0 && ` (série ${p.piecesParSerie || 1} pcs)`}
                        </span>
                        <button
                          type="button"
                          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold"
                        >
                          + {t('add')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Raccourcis POS F1, F2, F3, F4, F5, F6 Bar (Compact 13" optimized) */}
        <div className="bg-slate-800 border-b border-slate-700/80 px-3 py-1 flex items-center justify-between gap-1.5 text-xs text-white shrink-0 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
            <button
              type="button"
              onClick={() => handleValidateSale(false)}
              disabled={loading || cart.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-md shadow-2xs transition cursor-pointer disabled:opacity-50 text-[11px] whitespace-nowrap"
              title="Enregistrer la vente SANS imprimer le bon (Raccourci: Touche F1)"
            >
              <span className="px-1 py-0.2 bg-emerald-800 text-emerald-100 rounded text-[9px] font-mono">F1</span>
              <span>Enregistrer</span>
            </button>

            <button
              type="button"
              onClick={() => handleValidateSale(true)}
              disabled={loading || cart.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-md shadow-2xs transition cursor-pointer disabled:opacity-50 text-[11px] whitespace-nowrap"
              title="Enregistrer la vente ET imprimer le bon de commande (Raccourci: Touche F2)"
            >
              <span className="px-1 py-0.2 bg-blue-800 text-blue-100 rounded text-[9px] font-mono">F2</span>
              <Printer className="w-3 h-3" />
              <span>Enregistrer & Imprimer</span>
            </button>

            <button
              type="button"
              onClick={handleOpenEditModal}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-md shadow-2xs transition cursor-pointer text-[11px] whitespace-nowrap"
              title="Modifier un bon déjà passé / sélectionné (Raccourci: Touche F3)"
            >
              <span className="px-1 py-0.2 bg-amber-800 text-amber-100 rounded text-[9px] font-mono">F3</span>
              <span>Modifier</span>
            </button>

            <button
              type="button"
              onClick={toggleHistoryPanel}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-md shadow-2xs transition cursor-pointer text-[11px] whitespace-nowrap"
              title="Ouvrir l'historique des ventes, consulter les bons et réimprimer (Raccourci: Touche F4)"
            >
              <span className="px-1 py-0.2 bg-violet-800 text-violet-100 rounded text-[9px] font-mono">F4</span>
              <Clock className="w-3 h-3" />
              <span>Historique</span>
            </button>

            <button
              type="button"
              onClick={handleOpenReturnModal}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-md shadow-2xs transition cursor-pointer text-[11px] whitespace-nowrap"
              title="Effectuer un retour article ou avoir sur le bon"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retour</span>
            </button>

            {handleCreateNewPos && (
              <button
                type="button"
                onClick={handleCreateNewPos}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md shadow-2xs transition cursor-pointer text-[11px] whitespace-nowrap"
                title="Ouvrir un nouveau POS / Panier de vente (Raccourci: Touche F5)"
              >
                <span className="px-1 py-0.2 bg-indigo-800 text-indigo-100 rounded text-[9px] font-mono">F5</span>
                <Plus className="w-3 h-3" />
                <span>+ POS</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenCustomerModal}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-md shadow-2xs transition cursor-pointer text-[11px] whitespace-nowrap"
              title="Ajouter un nouveau client (Raccourci: Touche F6)"
            >
              <span className="px-1 py-0.2 bg-teal-800 text-teal-100 rounded text-[9px] font-mono">F6</span>
              <UserPlus className="w-3 h-3" />
              <span>+ Client</span>
            </button>

            <button
              type="button"
              onClick={handleSyncProducts}
              disabled={isSyncing}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded-md shadow-2xs transition cursor-pointer text-[11px] whitespace-nowrap disabled:opacity-50"
              title="Synchroniser et recharger les produits depuis la base de données (Raccourci: Touche F7)"
            >
              <span className="px-1 py-0.2 bg-cyan-950 text-cyan-200 rounded text-[9px] font-mono">F7</span>
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sync...' : 'Sync Produits'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetTicket}
              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-md shadow-2xs transition cursor-pointer text-[11px] whitespace-nowrap"
              title="Vider le panier et initialiser un nouveau ticket"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Nouveau</span>
            </button>
          </div>

          <div className="text-[10px] font-bold text-slate-300 hidden xl:block shrink-0">
            Saisie rapide : <span className="text-amber-400 font-mono">5*code</span>
          </div>
        </div>

        {/* Scan Feedback Banner */}
        {feedback && (
          <div className={`px-3 py-1.5 text-xs font-bold flex items-center justify-between animate-in slide-in-from-top duration-150 shrink-0 ${
            feedback.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}>
            <div className="flex items-center gap-2">
              {feedback.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              <span>{feedback.msg}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-[10px] underline cursor-pointer">OK</button>
          </div>
        )}

        {/* Document Format, Caisse, Tariff and Customer Selection (Compact 13" optimized) */}
        <div className="p-2 px-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          {/* Group 1: Document type & Caisse & Tarifs */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Type Document */}
            <div className="flex bg-slate-200/80 p-0.5 rounded-lg gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setTypeDocument('FACTURE')}
                className={`py-1 px-2 text-center text-[11px] font-bold rounded transition cursor-pointer truncate ${
                  typeDocument === 'FACTURE' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t('pos_printInvoice')}
              >
                Facture
              </button>
              <button
                type="button"
                onClick={() => setTypeDocument('TICKET')}
                className={`py-1 px-2 text-center text-[11px] font-bold rounded transition cursor-pointer truncate ${
                  typeDocument === 'TICKET' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t('pos_printTicket')}
              >
                Ticket
              </button>
              <button
                type="button"
                onClick={() => setTypeDocument('BON_COMMANDE')}
                className={`py-1 px-2 text-center text-[11px] font-bold rounded transition cursor-pointer truncate ${
                  typeDocument === 'BON_COMMANDE' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t('pos_bonCommande')}
              >
                B. Commande
              </button>
            </div>

            {/* Caisse Selector */}
            <select
              value={selectedCaisse}
              onChange={(e) => {
                setSelectedCaisse(e.target.value);
                localStorage.setItem('commercepost_active_caisse', e.target.value);
              }}
              className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-blue-500 shrink-0"
              title="Caisse / Vendeur actif"
            >
              {caisses.length > 0 ? (
                caisses.map((c) => (
                  <option key={c.id || c.nom} value={c.nom}>
                    {c.nom}
                  </option>
                ))
              ) : (
                <option value="Caisse 1">Caisse 1</option>
              )}
            </select>

            {/* Tarif Selector */}
            <div className="flex bg-slate-200/80 p-0.5 rounded-lg gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => handleSelectTarif('prixVente')}
                className={`py-0.5 px-1.5 text-[10px] font-bold rounded transition cursor-pointer ${
                  selectedTarif === 'prixVente' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t('price_detail')}
              >
                {t('pos_tarif_detail')}
              </button>
              <button
                type="button"
                onClick={() => handleSelectTarif('prixDemiGros')}
                className={`py-0.5 px-1.5 text-[10px] font-bold rounded transition cursor-pointer ${
                  selectedTarif === 'prixDemiGros' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t('price_demi_gros')}
              >
                {t('pos_tarif_demi')}
              </button>
              <button
                type="button"
                onClick={() => handleSelectTarif('prixGros')}
                className={`py-0.5 px-1.5 text-[10px] font-bold rounded transition cursor-pointer ${
                  selectedTarif === 'prixGros' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t('price_gros')}
              >
                {t('pos_tarif_gros')}
              </button>
              <button
                type="button"
                onClick={() => handleSelectTarif('prixSuperGros')}
                className={`py-0.5 px-1.5 text-[10px] font-bold rounded transition cursor-pointer ${
                  selectedTarif === 'prixSuperGros' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t('price_super_gros')}
              >
                {t('pos_tarif_super')}
              </button>
              <button
                type="button"
                onClick={() => handleSelectTarif('prixSerie')}
                className={`py-0.5 px-1.5 text-[10px] font-bold rounded transition cursor-pointer ${
                  selectedTarif === 'prixSerie' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t('price_serie')}
              >
                📦 {t('pos_tarif_serie')}
              </button>
            </div>
          </div>

          {/* Group 2: Client & Counter Client */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[280px] justify-end">
            <select
              value={selectedCustomerId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCustomerId(val);
                if (val) {
                  const found = customers.find((c) => String(c._id || c.id) === String(val));
                  if (found) setNomClientLibre(found.nom);
                }
              }}
              className="max-w-[200px] flex-1 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-blue-500 truncate"
            >
              <option value="">-- {t('pos_counterClient')} --</option>
              {customers.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.nom} {c.telephone ? `(${c.telephone})` : ''} - {t('cust_debtBalance')}: {c.soldeDette || 0} {t('currency')}
                </option>
              ))}
            </select>

            {!selectedCustomerId && (
              <input
                type="text"
                list="pos-clients-suggestions"
                value={nomClientLibre}
                onChange={(e) => setNomClientLibre(e.target.value)}
                className="w-32 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-blue-500"
                placeholder={t('pos_counterClient')}
                title="Nom du client de passage"
              />
            )}
            <datalist id="pos-clients-suggestions">
              {customers.map((c) => (
                <option key={c._id || c.id} value={c.nom} />
              ))}
            </datalist>

            {selectedCustomerId && (
              <button
                type="button"
                onClick={() => setIsCustomerLedgerOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 transition cursor-pointer shrink-0"
                title="Historique des bons et relevé de compte de ce client"
              >
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                <span>Bons & Relevé</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenCustomerModal}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-lg border border-teal-200 transition cursor-pointer shrink-0"
              title="Ajouter un nouveau client (Raccourci: Touche F6)"
            >
              <UserPlus className="w-3.5 h-3.5 text-teal-600" />
              <span>+ Client (F6)</span>
            </button>
          </div>
        </div>

        {/* Coordonnées détaillées du client actif */}
        {(() => {
          const activeCustomer = customers.find((c) => String(c._id || c.id) === String(selectedCustomerId));
          if (!activeCustomer) return null;
          const solde = Number(activeCustomer.soldeDette || 0);
          return (
            <div className="px-3 py-1.5 bg-blue-50/90 border-b border-blue-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 animate-in fade-in duration-150">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-black text-blue-950 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>Client : {activeCustomer.nom}</span>
                </span>
                {activeCustomer.telephone && (
                  <span className="font-semibold text-slate-700 flex items-center gap-1 font-mono">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>Tél : {activeCustomer.telephone}</span>
                  </span>
                )}
                {activeCustomer.adresse && (
                  <span className="text-slate-600 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>Adresse : {activeCustomer.adresse}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-bold uppercase">Solde Dette :</span>
                <span className={`font-black px-2 py-0.5 rounded-md text-xs font-mono ${
                  solde > 0 ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {solde.toLocaleString('fr-DZ')} DA
                </span>
                <button
                  type="button"
                  onClick={() => setIsCustomerLedgerOpen(true)}
                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded transition cursor-pointer"
                  title="Consulter les anciens bons et modifier les articles/prix"
                >
                  Historique Bons & Relevé
                </button>
              </div>
            </div>
          );
        })()}

        {/* Toggle Mode: Panier de Vente / Catalogue Photos (Compact 13" optimized) */}
        <div className="px-3 py-1.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setPosViewMode('cart')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded transition cursor-pointer ${
                posViewMode === 'cart'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Panier de vente</span>
              {cart.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                  {cart.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setPosViewMode('catalog')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded transition cursor-pointer ${
                posViewMode === 'catalog'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Catalogue Photos</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${posViewMode === 'catalog' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {products.length}
              </span>
            </button>
          </div>

          {posViewMode === 'catalog' ? (
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={catalogFilterText}
                  onChange={(e) => setCatalogFilterText(e.target.value)}
                  placeholder="Recherche dans le catalogue..."
                  className="w-full pl-7 pr-2.5 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:outline-blue-500"
                />
                {catalogFilterText && (
                  <button
                    type="button"
                    onClick={() => setCatalogFilterText('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 font-semibold">
              {cart.length} article{cart.length > 1 ? 's' : ''} • {cart.reduce((s, i) => s + (Number(i.quantite) || 0), 0)} unités au panier
            </div>
          )}
        </div>

        {/* CONTENU PRINCIPAL: PANIER OU CATALOGUE PHOTOS */}
        {posViewMode === 'cart' ? (
          /* 1. Tableau classique du panier (Compact 13" optimized) */
          <div className="flex-1 min-h-0 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider sticky top-0 z-10 text-[11px]">
                <tr>
                  <th className="px-3 py-1.5">{t('pos_scannedArticle')}</th>
                  <th className="px-3 py-1.5 text-center">{t('pos_quantity')}</th>
                  <th className="px-3 py-1.5 text-right">{t('pos_unitPrice')}</th>
                  <th className="px-3 py-1.5 text-right">{t('pos_totalLine')}</th>
                  <th className="px-3 py-1.5 text-center">{t('delete')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.length > 0 ? (
                  cart.map((item) => {
                    const isWeighed = item.unite === 'kg' || item.unite === 'g' || item.unite === 'litre';
                    const step = isWeighed ? 0.1 : 1;
                    return (
                      <tr key={item.productId} className="hover:bg-blue-50/40 transition">
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2.5">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.nom}
                                className="w-8 h-8 object-cover rounded-lg border border-slate-200 bg-slate-50 shrink-0 shadow-2xs"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-800 block text-xs">{item.nom}</span>
                                {isWeighed && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-800 uppercase">
                                    {t('pos_weightTag')} ({item.unite})
                                  </span>
                                )}
                                {Boolean(item.prixSerie > 0 || (item.piecesParSerie && item.piecesParSerie > 1)) && (
                                  <button
                                    type="button"
                                    onClick={() => toggleCartItemSerie(item.productId, item.isSerie)}
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-black border transition cursor-pointer flex items-center gap-0.5 ${
                                      item.isSerie
                                        ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                                        : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                    }`}
                                    title="Cliquer pour basculer Vente Pièce / Vente Série"
                                  >
                                    <span>{item.isSerie ? `📦 SÉRIE (${item.piecesParSerie || 1} pcs)` : `📄 PIÈCE`}</span>
                                  </button>
                                )}
                                {item.prixAchat > 0 && item.prixUnitaire < item.prixAchat && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-black bg-rose-600 text-white animate-pulse" title={`${t('loss_sale_warning')}: Achat = ${item.prixAchat} ${t('currency')}`}>
                                    ⚠️ {t('loss_sale_warning')}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {t('ref')}: {item.reference} ({t('pos_stockAvailable')}: {item.maxStock} {item.defaultUnite || 'pcs'})
                                {item.prixAchat > 0 && ` • PA: ${Number(item.prixAchat).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${t('currency')}`}
                                {item.isSerie && (
                                  <span className="ml-1 text-amber-700 font-bold">
                                    • Décompte: {Number(item.quantite) * Number(item.piecesParSerie || 1)} pcs
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <div className="inline-flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.productId, item.quantite - step)}
                              className="w-5 h-5 rounded bg-white font-bold text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer shadow-2xs text-xs"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              step="any"
                              value={item.quantite ?? ''}
                              onChange={(e) => updateCartQuantity(item.productId, e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                              onFocus={(e) => e.target.select()}
                              placeholder="0"
                              className="w-14 text-center font-bold text-xs bg-transparent focus:outline-hidden py-0.5"
                            />
                            <span className="text-[10px] font-bold text-slate-500 pr-0.5">{item.unite}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.productId, item.quantite + step)}
                              className="w-5 h-5 rounded bg-white font-bold text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer shadow-2xs text-xs"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <input
                              type="number"
                              step="0.001"
                              placeholder="0.000"
                              value={item.prixUnitaire ?? ''}
                              onChange={(e) => updateCartPrice(item.productId, e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                              onFocus={(e) => e.target.select()}
                              className={`w-20 px-1.5 py-0.5 border rounded-lg text-right font-bold text-xs focus:bg-white focus:outline-blue-500 ${
                                item.prixAchat > 0 && item.prixUnitaire < item.prixAchat 
                                  ? 'bg-rose-50 border-rose-500 text-rose-700' 
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            />
                            <span className="text-[10px] text-slate-400 font-bold">/{item.unite}</span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right font-black text-slate-800 text-xs">
                          {(item.prixUnitaire * item.quantite).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {t('currency')}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.productId)}
                            className="p-1 rounded-md text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="py-10 text-center text-slate-400">
                      <QrCode className="w-10 h-10 mx-auto mb-1 opacity-30 animate-pulse" />
                      <p className="text-xs font-bold text-slate-600">{t('pos_emptyCart')}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{t('pos_emptyCartSub')}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* 2. Catalogue visuel de sélection directe par photos */
          <div className="flex-1 overflow-y-auto p-4 bg-slate-100/70 flex flex-col space-y-3">
            {/* Category Pills Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-thin">
              {catalogCategories.map((cat) => {
                const isSelected = selectedCatalogCategory === cat;
                const count = cat === 'TOUS' ? products.length : products.filter((p) => p.categorie === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCatalogCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isSelected ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Products Visual Grid */}
            {filteredCatalogProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pb-6">
                {filteredCatalogProducts.map((p) => {
                  const pId = p._id || p.id;
                  const inCartQty = cartItemQuantities[pId] || 0;
                  const unitPrice = getProductPrice(p, selectedTarif);
                  const isLow = Number(p.quantite || 0) <= Number(p.seuilAlerte || 5);

                  return (
                    <div
                      key={pId}
                      onClick={() => addProductToCart(p, scanQuantity)}
                      className="group relative bg-white border border-slate-200 hover:border-blue-500 rounded-2xl p-2.5 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between overflow-hidden active:scale-95 select-none"
                    >
                      {/* In-cart count badge */}
                      {inCartQty > 0 && (
                        <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white shadow-md animate-in fade-in zoom-in duration-100">
                          x{inCartQty}
                        </div>
                      )}

                      {/* Product Photo or Placeholder */}
                      <div className="relative w-full h-28 rounded-xl overflow-hidden bg-slate-50 mb-2 border border-slate-100 flex items-center justify-center">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.nom}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-300 group-hover:text-blue-400 transition">
                            <Package className="w-10 h-10 mb-1 opacity-60" />
                            <span className="text-[10px] font-bold text-slate-400">Sans photo</span>
                          </div>
                        )}
                        {/* Quick Add overlay button */}
                        <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <span className="px-2 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-black shadow-md flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Ajouter (+{scanQuantity})
                          </span>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="space-y-1">
                        <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                          <span className="truncate">{p.reference || p.codeBarre}</span>
                          <span className={`font-bold ${isLow ? 'text-rose-600 font-black' : 'text-slate-500'}`}>
                            {p.quantite} {p.unite || 'pcs'}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-blue-600 transition" title={p.nom}>
                          {p.nom}
                        </h4>

                        {(p.taille || p.pointure || p.couleur) && (
                          <div className="flex flex-wrap gap-1 text-[9px] text-slate-500 font-medium">
                            {p.taille && <span className="bg-slate-100 px-1 rounded">T:{p.taille}</span>}
                            {p.pointure && <span className="bg-slate-100 px-1 rounded">P:{p.pointure}</span>}
                            {p.couleur && <span className="bg-slate-100 px-1 rounded">{p.couleur}</span>}
                          </div>
                        )}

                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-black text-emerald-600">
                            {Number(unitPrice || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA
                          </span>
                          {selectedTarif === 'prixSerie' && p.prixSerie > 0 && (
                            <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">
                              Série {p.piecesParSerie || 1} pcs
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
                <ImageIcon className="w-12 h-12 opacity-30 mb-2" />
                <p className="text-sm font-bold text-slate-600">Aucun produit dans cette sélection</p>
                <p className="text-xs text-slate-400 mt-0.5">Essayez une autre catégorie ou modifiez votre filtre</p>
              </div>
            )}
          </div>
        )}

        {/* Bottom Cart Checkout Footer (Compact 13" optimized) */}
        <div className="p-2.5 px-3 bg-slate-900 text-white border-t border-slate-800 shrink-0 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Left: Mode paiement & Montant reçu */}
            <div className="flex items-center gap-2">
              <div>
                <label className="block text-[9px] font-bold uppercase text-slate-400 leading-tight mb-0.5">{t('pos_paymentMethod')}</label>
                <select
                  value={modePaiement}
                  onChange={(e) => setModePaiement(e.target.value)}
                  className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-blue-500 cursor-pointer"
                >
                  <option value="ESPECES">{t('pos_cash')}</option>
                  <option value="CARTE">{t('pos_card')}</option>
                  <option value="VIREMENT">{t('pos_transfer')}</option>
                  <option value="A_CREDIT">{t('pos_credit')}</option>
                  <option value="CHEQUE">{t('pos_check')}</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-slate-400 leading-tight mb-0.5">{t('pos_amountReceived')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder="0.000"
                  value={montantPaye ?? ''}
                  onChange={(e) => setMontantPaye(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                  onFocus={(e) => e.target.select()}
                  className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-black text-emerald-400 focus:outline-blue-500 text-right"
                />
              </div>

              {/* Reste / Dette alert pill */}
              {montantReste > 0 && (
                <div className="px-2 py-1 bg-rose-950/70 border border-rose-800/80 rounded-lg">
                  <span className="text-[9px] font-bold uppercase text-rose-400 block leading-tight">{t('cust_debtBalance')}</span>
                  <span className="text-xs font-black text-rose-400">+{Number(montantReste).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {t('currency')}</span>
                </div>
              )}
            </div>

            {/* Right: Total TTC & Validate Actions */}
            <div className="flex items-center gap-3 ml-auto">
              <div className="text-right">
                <span className="text-[9px] font-bold uppercase text-slate-400 block leading-tight">{t('pos_totalTtc')}</span>
                <span className="text-xl font-black text-emerald-400 tracking-tight">
                  {Number(totalTTC).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {t('currency')}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={loading || cart.length === 0}
                  onClick={handlePrintWithoutSaving}
                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-bold text-amber-300 border border-slate-600 shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                  title="Imprimer directement le bon sans enregistrer la vente en base ni déstocker (Devis / Provisoire)"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-300" />
                  <span>Imprimer sans enregistrer</span>
                </button>

                <button
                  type="button"
                  disabled={loading || cart.length === 0}
                  onClick={() => handleValidateSale(false)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black text-white shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                  title="Enregistrer la vente SANS imprimer le ticket (Raccourci: Touche F1)"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Valider (F1)</span>
                </button>

                <button
                  type="button"
                  disabled={loading || cart.length === 0}
                  onClick={() => handleValidateSale(true)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black text-white shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                  title="Enregistrer la vente ET imprimer le bon (Raccourci: Touche F2)"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Valider & Imprimer (F2)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DRAGGABLE RESIZER HANDLE (Visible uniquement quand le panneau est ouvert) */}
      {!isRightPanelCollapsed && (
        <div
          onMouseDown={() => setIsDraggingDivider(true)}
          className={`hidden lg:flex w-2.5 hover:w-3 bg-slate-200 hover:bg-blue-500 active:bg-blue-600 transition-all cursor-col-resize items-center justify-center shrink-0 z-20 select-none ${
            isDraggingDivider ? 'bg-blue-600 w-3' : ''
          }`}
          title="Glisser pour redimensionner la fenêtre de facture / détail"
        >
          <div className="w-0.5 h-8 bg-slate-400/80 rounded-full" />
        </div>
      )}

      {/* RIGHT PANEL: ORDER DETAILS (TICKET) & SESSION HISTORY */}
      {isRightPanelCollapsed ? (
        <div className="hidden lg:flex flex-col items-center justify-between py-3 px-1 bg-slate-800 text-slate-300 border-l border-slate-700 w-10 shrink-0 select-none">
          <button
            type="button"
            onClick={toggleHistoryPanel}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-violet-400 hover:text-violet-300 transition cursor-pointer"
            title="Ouvrir l'Historique (F4)"
          >
            <Clock className="w-4 h-4" />
          </button>
          <div 
            onClick={toggleHistoryPanel}
            className="text-[10px] font-black tracking-widest uppercase text-slate-300 hover:text-white cursor-pointer py-4"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            HISTORIQUE ({recentInvoices.length})
          </div>
          <button
            type="button"
            onClick={() => {
              setIsRightPanelCollapsed(false);
              setRightTab('detail');
            }}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-emerald-400 hover:text-white transition cursor-pointer"
            title="Ouvrir le détail du ticket actif"
          >
            <Receipt className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div 
          style={{ width: `${rightPanelWidth}px` }}
          className="w-full bg-white flex flex-col shrink-0 border-l border-slate-200 overflow-hidden"
        >
          {/* Tab switcher with Collapse Button */}
          <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
            <button
              onClick={() => setRightTab('detail')}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                rightTab === 'detail'
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{t('pos_orderDetail')}</span>
            </button>
            <button
              onClick={() => setRightTab('history')}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                rightTab === 'history'
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t('pos_history')} ({recentInvoices.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setIsRightPanelCollapsed(true)}
              className="px-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer flex items-center justify-center border-l border-slate-200"
              title="Masquer le panneau pour agrandir la caisse (Écran 13 pouces)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        {/* TAB 1: ORDER DETAIL & RECEIPT VIEW */}
        {rightTab === 'detail' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
            {activeInvoice ? (
              <>
                {/* Print button top bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 no-print bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-700 font-mono">{activeInvoice.numeroFacture}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(activeInvoice)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition cursor-pointer"
                      title="Modifier ce bon de commande (F3)"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Modifier (F3)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenReturnModal(activeInvoice)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition cursor-pointer"
                      title="Retour / Avoir sur ce bon (F4)"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{t('return')} (F4)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosReceiptRotation((r) => (r + 90) % 360)}
                      className="inline-flex items-center gap-1 px-1.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition cursor-pointer"
                      title="Changer l'angle de rotation (0°, 90°, 180°, 270°)"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>{posReceiptRotation}°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintSprt80(activeInvoice)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition shadow-2xs cursor-pointer"
                      title="Imprimer directement sur SPRT 80 (Thermique 80mm)"
                    >
                      <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                      <span>SPRT 80</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintA4(activeInvoice)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-800 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded-lg transition shadow-2xs cursor-pointer"
                      title="Imprimer directement en pleine page format A4"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-700" />
                      <span>Facture A4</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportPdf(activeInvoice)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg transition shadow-2xs cursor-pointer"
                      title="Exporter ce bon au format PDF officiel"
                    >
                      <FileDown className="w-3.5 h-3.5 text-rose-600" />
                      <span>Exporter PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintActiveInvoice(activeInvoice)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition shadow-xs cursor-pointer"
                      title="Impression directe du bon de commande"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{t('print')}</span>
                    </button>
                  </div>
                </div>

                {/* Printable Ticket Area - Conforme au Bon de Commande réel */}
                {(() => {
                  const cfg = getPrinterSettings();
                  const dateObj = new Date(activeInvoice.createdAt || activeInvoice.dateFacture || Date.now());
                  const day = String(dateObj.getDate()).padStart(2, '0');
                  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                  const year = dateObj.getFullYear();
                  const hours = String(dateObj.getHours()).padStart(2, '0');
                  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                  const seconds = String(dateObj.getSeconds()).padStart(2, '0');
                  const dateFormatted = `${day}/${month}/${year}-${hours}:${minutes}:${seconds}`;

                  const ticketNum = String(activeInvoice.numeroFacture || activeInvoice.numeroTicket || '036009').trim();
                  const cleanTicketBarcode = ticketNum.replace(/[^A-Za-z0-9]/g, '') || '036009';
                  const barcodeDataUrl = createBarcodeDataUrl(cleanTicketBarcode, { width: 2, height: 42, format: 'CODE128' });

                  const clientName = (activeInvoice.client?.nom || activeInvoice.nomClientLibre || activeInvoice.clientLibre || 'Client Comptoir').toUpperCase();
                  const clientPhone = activeInvoice.client?.telephone || activeInvoice.telephoneClient || '';
                  const clientAddress = activeInvoice.client?.adresse || activeInvoice.adresseClient || '';
                  
                  const caissierName = (
                    activeInvoice.caissier || 
                    activeInvoice.vendeur || 
                    activeInvoice.creePar || 
                    currentUser?.nom || 
                    currentUser?.username || 
                    'ILYES'
                  ).toUpperCase();

                  const rawItems = Array.isArray(activeInvoice.items) && activeInvoice.items.length > 0 
                    ? activeInvoice.items 
                    : (Array.isArray(activeInvoice.lignes) ? activeInvoice.lignes : []);

                  let totalQty = 0;
                  let totalBrut = 0;

                  rawItems.forEach((it) => {
                    const qty = Number(it.quantite ?? it.qty ?? 1);
                    const pu = Number(it.prixUnitaire ?? (it.totalLigne ? it.totalLigne / qty : 0));
                    const lineTotal = Number(it.totalLigne ?? (qty * pu));
                    totalQty += qty;
                    totalBrut += lineTotal;
                  });

                  const nbrArt = rawItems.length;
                  const totalTTC = Number(activeInvoice.totalTTC ?? totalBrut);
                  const remise = Number(activeInvoice.remise ?? Math.max(0, totalBrut - totalTTC));
                  const montantPaye = Number(activeInvoice.montantPaye ?? totalTTC);
                  const ancienSolde = Number(activeInvoice.client?.soldeDette ?? activeInvoice.ancienSolde ?? 0);
                  const nouveauSolde = Math.max(0, Math.round((ancienSolde + totalTTC - montantPaye) * 100) / 100);

                  return (
                    <div 
                      id="pos-printable-receipt" 
                      className="print-area bg-white p-4 rounded-xl border border-slate-300 text-black shadow-xs w-full font-sans select-text text-[13px] leading-tight font-black"
                    >
                      {/* Logo si configuré */}
                      {cfg.showReceiptLogo && cfg.storeLogo && (
                        <div className="text-center mb-1">
                          <img src={cfg.storeLogo} alt="Logo" className="max-w-[130px] max-h-[65px] object-contain mx-auto grayscale" />
                        </div>
                      )}

                      {/* En-tête Magasin */}
                      {cfg.receiptShowStoreHeader !== false && (
                        <div className="text-center mb-1">
                          <div className="text-base font-black uppercase tracking-wide text-black">{cfg.storeName?.trim() || 'COMMERCEPOST'}</div>
                          {cfg.storeSubtitle && <div className="text-xs font-black uppercase text-black">{cfg.storeSubtitle}</div>}
                          {cfg.storeAddress && <div className="text-[11px] font-bold text-black">{cfg.storeAddress}</div>}
                          {cfg.storeCity && <div className="text-[11px] font-bold text-black">{cfg.storeCity}</div>}
                          {cfg.storePhone && <div className="text-[11px] font-bold text-black">{cfg.storePhone}</div>}
                        </div>
                      )}

                      {/* Badge Type de document */}
                      <div className="text-center my-1">
                        <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 border border-black/30 text-black">
                          {activeInvoice.typeDocument === 'BON_COMMANDE' ? '★ BON DE COMMANDE ★' : activeInvoice.typeDocument === 'FACTURE' ? 'FACTURE DE VENTE' : 'TICKET DE CAISSE'}
                        </span>
                      </div>

                      {/* Séparateur pointillé */}
                      <div className="border-t border-dashed border-black my-1.5" />

                      {/* Tableau des articles - Exactement comme sur le ticket thermique */}
                      <table className="w-full border-collapse my-1 text-[13px] font-black text-black">
                        <thead>
                          <tr className="text-[11px] uppercase border-b border-black">
                            <th className="text-start py-0.5 w-[44%] font-black">LIBELLE</th>
                            <th className="text-center py-0.5 w-[14%] font-black">QTE</th>
                            <th className="text-end py-0.5 w-[21%] font-black">P.U</th>
                            <th className="text-end py-0.5 w-[21%] font-black">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rawItems.map((it, idx) => {
                            let name = (it.nom || it.designation || it.product_nom || it.product?.nom || it.reference || 'Article').toUpperCase();
                            if (it.isSerie || (it.piecesParSerie && Number(it.piecesParSerie) > 1)) {
                              name += ` (Série de ${it.piecesParSerie || 1} pcs)`;
                            }
                            const isReturned = (it.quantiteRetournee > 0 && it.quantite === 0) || Number(it.quantite) === 0;
                            const qty = Number(it.quantite ?? it.qty ?? 1);
                            const pu = Number(it.prixUnitaire ?? (it.totalLigne ? it.totalLigne / qty : 0));
                            const lineTotal = Number(it.totalLigne ?? (qty * pu));

                            return (
                              <React.Fragment key={idx}>
                                <tr>
                                  <td colSpan={4} className={`pt-1.5 pb-0.5 text-start font-black text-black break-words ${isReturned ? 'line-through text-slate-500' : ''}`}>
                                    {name}
                                    {isReturned && <span className="ml-1 text-[9px] text-rose-600 no-underline font-bold">(Retourné)</span>}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-100">
                                  <td></td>
                                  <td className="text-center font-black pb-1">{qty}</td>
                                  <td className="text-end font-black pb-1">{formatCurrencyDz(pu)}</td>
                                  <td className="text-end font-black pb-1">{formatCurrencyDz(lineTotal)}</td>
                                </tr>
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Ligne récapitulatif Articles et Quantités */}
                      {cfg.receiptShowNbrArt !== false && (
                        <>
                          <div className="border-t border-dashed border-black my-1.5" />
                          <div className="flex justify-between items-center text-xs font-black text-black py-0.5">
                            <span>NBR ART : {nbrArt}, TQTE : {totalQty}</span>
                          </div>
                        </>
                      )}

                      {/* Bloc Totaux */}
                      {(cfg.receiptShowTotalBrut !== false || (remise > 0 && cfg.receiptShowRemise !== false) || cfg.receiptShowTtcAPayer !== false) && (
                        <>
                          <div className="border-t border-dashed border-black my-1.5" />
                          <div className="space-y-0.5 text-[13px] font-black text-black">
                            {cfg.receiptShowTotalBrut !== false && (
                              <div className="flex justify-between">
                                <span>TOTAL :</span>
                                <span>{formatCurrencyDz(totalBrut)}</span>
                              </div>
                            )}
                            {remise > 0 && cfg.receiptShowRemise !== false && (
                              <div className="flex justify-between">
                                <span>REMISE :</span>
                                <span>{formatCurrencyDz(remise)}</span>
                              </div>
                            )}
                            {cfg.receiptShowTtcAPayer !== false && (
                              <div className="flex justify-between text-sm font-black pt-0.5 border-t border-black/20">
                                <span>TTC A PAYER :</span>
                                <span>{formatCurrencyDz(totalTTC)}</span>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* Bloc Soldes / Dette */}
                      {(cfg.receiptShowAncienSolde !== false || cfg.receiptShowTotalAchat !== false || cfg.receiptShowVersement !== false || cfg.receiptShowNouveauSolde !== false) && (
                        <div className="mt-1.5 pt-1 border-t border-dashed border-black/40 space-y-0.5 text-[12px] font-black text-black">
                          {cfg.receiptShowAncienSolde !== false && (
                            <div className="flex justify-between">
                              <span>Anc. solde:</span>
                              <span>{formatCurrencyDz(ancienSolde)}</span>
                            </div>
                          )}
                          {cfg.receiptShowTotalAchat !== false && (
                            <div className="flex justify-between">
                              <span>Total achat:</span>
                              <span>{formatCurrencyDz(totalTTC)}</span>
                            </div>
                          )}
                          {cfg.receiptShowVersement !== false && (
                            <div className="flex justify-between">
                              <span>Versement :</span>
                              <span>{formatCurrencyDz(montantPaye)}</span>
                            </div>
                          )}
                          {cfg.receiptShowNouveauSolde !== false && (
                            <div className="flex justify-between text-black">
                              <span>Nouv. solde:</span>
                              <span>{formatCurrencyDz(nouveauSolde)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Coordonnées Client */}
                      {(cfg.receiptShowCustomerName !== false || (clientPhone && cfg.receiptShowCustomerPhone !== false) || (clientAddress && cfg.receiptShowCustomerAddress !== false)) && (
                        <>
                          <div className="border-t border-dashed border-black my-1.5" />
                          <div className="text-start text-xs font-black text-black py-0.5">
                            {cfg.receiptShowCustomerName !== false && <div>Client : {clientName}</div>}
                            {clientPhone && cfg.receiptShowCustomerPhone !== false && <div className="text-[11px]">Tél : {clientPhone}</div>}
                            {clientAddress && cfg.receiptShowCustomerAddress !== false && <div className="text-[11px]">Adresse : {clientAddress}</div>}
                          </div>
                        </>
                      )}

                      {/* Code-barres CODE128 comme sur le vrai ticket */}
                      {cfg.receiptShowBarcode !== false && (
                        <>
                          <div className="border-t border-dashed border-black my-1.5" />
                          <div className="text-center my-1.5">
                            {barcodeDataUrl && (
                              <img src={barcodeDataUrl} alt={cleanTicketBarcode} className="max-w-[90%] h-10 object-contain mx-auto" />
                            )}
                            <div className="font-mono text-xs tracking-widest font-black text-black mt-0.5">
                              {cleanTicketBarcode}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Infos de bas de ticket */}
                      {(cfg.receiptShowDate !== false || cfg.receiptShowCashier !== false) && (
                        <>
                          <div className="border-t border-dashed border-black my-1.5" />
                          <div className="text-[11px] font-black text-black space-y-0.5">
                            <div className="flex justify-between items-center">
                              <span>Ticket : {cleanTicketBarcode}</span>
                              {cfg.receiptShowDate !== false && <span>{dateFormatted}</span>}
                            </div>
                            {cfg.receiptShowCashier !== false && (
                              <div className="text-start">
                                <span>Caissier : {caissierName}</span>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* Pied de page personnalisé ou message de bienvenue */}
                      {cfg.receiptFooter ? (
                        <>
                          <div className="border-t border-dashed border-black my-1.5" />
                          <div className="text-center text-[11px] font-black text-black whitespace-pre-line">
                            {cfg.receiptFooter}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="border-t border-dashed border-black my-1.5" />
                          <div className="text-center text-[10px] font-black text-black uppercase">
                            ★ {t('receipt_completion_msg') || 'Merci de votre visite et à bientôt !'} ★
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="py-16 text-center text-slate-400 text-xs">
                {t('pos_noOrderSelected')}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SESSION INVOICES HISTORY */}
        {rightTab === 'history' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-3 space-y-2">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-xs font-bold text-slate-600">
                {historySearch ? `Résultats recherche (${(searchedInvoices || []).length})` : t('pos_todaySales')}
              </span>
              <button onClick={loadData} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Input de recherche Bon de commande / BL pour Retour ou Opérations */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-blue-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Chercher Bon (N°, Client, Date)..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:outline-blue-500 placeholder:text-slate-400"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {(searchedInvoices || recentInvoices).length > 0 ? (
              (searchedInvoices || recentInvoices).map((inv) => (
                <div
                  key={inv._id || inv.id || inv.numeroFacture}
                  onClick={() => {
                    setActiveInvoice(inv);
                    setRightTab('detail');
                  }}
                  className={`p-3 rounded-xl border transition cursor-pointer flex flex-col gap-2 ${
                    activeInvoice?._id === inv._id
                      ? 'bg-blue-50/70 border-blue-300 shadow-2xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-800 font-mono block">{inv.numeroFacture}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(inv.dateFacture || inv.createdAt).toLocaleTimeString(isRTL ? 'ar-DZ' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })} • {inv.client?.nom || inv.nomClientLibre || inv.clientLibre || t('pos_counterClient')}
                      </span>
                    </div>

                    <div className="text-end">
                      <span className="font-black text-xs text-slate-900 block">{Number(inv.totalTTC || 0).toLocaleString(isRTL ? 'ar-DZ' : 'fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {t('currency')}</span>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${
                        inv.statutPaiement === 'PAYE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {inv.statutPaiement === 'PAYE' ? t('inv_paid') : inv.statutPaiement === 'PARTIEL' ? t('inv_partial') : t('inv_unpaid')}
                      </span>
                    </div>
                  </div>

                  {/* Actions rapides sur chaque bon */}
                  <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveInvoice(inv);
                        handleOpenEditModal(inv);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition cursor-pointer"
                      title="Modifier les articles de ce bon"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                      <span>Modifier</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveInvoice(inv);
                        handleOpenReturnModal(inv);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-200 transition cursor-pointer"
                      title="Effectuer un retour sur ce bon"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Retour</span>
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const full = await api.invoice.getById(inv._id || inv.id || inv.numeroFacture);
                          const data = (full && full.success && full.data) ? full.data : inv;
                          const html = generateReceiptHtml({
                            invoice: data,
                            docType: 'BON_LIVRAISON'
                          });
                          await printHtmlContent(html, { silent: true });
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 transition cursor-pointer"
                      title="Imprimer le Bon de Livraison (BL)"
                    >
                      <Truck className="w-2.5 h-2.5" />
                      <span>BL</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrintSprt80(inv);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200 transition cursor-pointer"
                      title="Imprimer directement sur SPRT 80"
                    >
                      <Receipt className="w-2.5 h-2.5" />
                      <span>SPRT 80</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportPdf(inv);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-200 transition cursor-pointer"
                      title="Exporter ce bon en PDF"
                    >
                      <FileDown className="w-2.5 h-2.5" />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                {t('pos_noSalesToday')}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Sale Return Modal */}
      <SaleReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          setReturnInvoice(null);
        }}
        invoice={returnInvoice}
        onReturnProcessed={() => {
          showNotification('Retour enregistré avec succès.');
          loadData();
        }}
      />

      {/* Edit Invoice Modal (F3 shortcut) */}
      <EditInvoiceModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setInvoiceToEdit(null);
        }}
        invoice={invoiceToEdit}
        onInvoiceUpdated={(updated) => {
          showNotification(`Bon ${updated?.numeroFacture || ''} modifié avec succès.`);
          setActiveInvoice(updated);
          loadData();
        }}
      />

      {/* New Customer Modal (F6 shortcut) */}
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customer={null}
        onSaved={handleCustomerSaved}
      />

      {/* Customer Ledger & Invoices Modal (Historique des bons & modification) */}
      {isCustomerLedgerOpen && selectedCustomerId && (
        <CustomerLedgerModal
          isOpen={isCustomerLedgerOpen}
          onClose={() => setIsCustomerLedgerOpen(false)}
          customer={customers.find((c) => String(c._id || c.id) === String(selectedCustomerId))}
          onPaymentRecorded={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}
