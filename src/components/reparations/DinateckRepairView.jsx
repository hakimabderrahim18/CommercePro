import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Plus, 
  Search, 
  Clock, 
  CheckCircle, 
  Package, 
  User, 
  Printer, 
  Tag, 
  Smartphone, 
  Calendar, 
  DollarSign, 
  ArrowLeft, 
  ArrowRight,
  MoveRight,
  MoveLeft,
  Save, 
  FileText, 
  AlertCircle, 
  Trash2, 
  Edit3, 
  Check, 
  HelpCircle, 
  X,
  History,
  ShieldCheck,
  Truck,
  RotateCcw,
  Sparkles,
  Barcode,
  List,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Phone,
  Wallet
} from 'lucide-react';
import Modal from '../common/Modal';
import RepairLabelModal from './RepairLabelModal';
import TechniciansAccountsModal from './TechniciansAccountsModal';
import PieceSearchAutocomplete from './PieceSearchAutocomplete';
import RepairExitModal from './RepairExitModal';
import { api } from '../../services/api';
import { printHtmlContent, getPrinterSettings, formatCurrencyDz } from '../../utils/printerHelper';
import { 
  generateRepairLabelHtml, 
  printRepairLabel,
  generateRepairReceiptHtml, 
  generateRepairDeliveryHtml,
  generateRepairEstimateHtml,
  generateRepairWorkshopSheetHtml
} from '../../utils/repairPrinterHelper';

export default function DinateckRepairView({
  reparations = [],
  customers = [],
  stockProducts = [],
  technicians = [],
  caisses = [],
  currentUser = null,
  onRefresh = () => {},
  loadData = null,
  onToggleMode = () => {},
  showNotification = () => {}
}) {
  const doRefresh = () => {
    if (typeof loadData === 'function') loadData();
    if (typeof onRefresh === 'function') onRefresh();
  };

  const [layoutMode, setLayoutMode] = useState('liste'); // 'liste' | 'kanban' | 'calendrier'
  const [viewMode, setViewMode] = useState('liste'); // 'liste' | 'kanban' | 'calendrier' | 'fiche'
  const [activeTab, setActiveTab] = useState('informations'); // 'informations' | 'documents' | 'travaux' | 'financier' | 'historique'
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('TOUS');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [draggedRepId, setDraggedRepId] = useState(null);
  
  // Fiche active
  const [selectedRep, setSelectedRep] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modal Nouvel Ordre de Réparation & Sortie
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isTechAccountsModalOpen, setIsTechAccountsModalOpen] = useState(false);
  const [exitModalRep, setExitModalRep] = useState(null);
  const [newOrderForm, setNewOrderForm] = useState({
    clientNom: '',
    clientTelephone: '',
    client_id: '',
    appareilType: 'Smartphone',
    marque: '',
    modele: '',
    numeroSerie: '',
    motDePasseAppareil: '',
    accessoires: 'Sans accessoire',
    panneDeclaree: '',
    estimationDevis: '',
    acomptePaye: '',
    acomptePayeMaintenant: false,
    modePaiement: 'ESPECES',
    priorite: 'Normale',
    delaiEstime: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    reparateur_id: '',
    reparateurNom: '',
    caisse: currentUser?.caisse || 'Caisse 1 (Magasin)',
    etatReception: 'Bon état',
    sousGarantie: false,
    notes: ''
  });

  // Section Travaux (Main d'œuvre & Pièces)
  const [moMode, setMoMode] = useState('FORFAIT'); // 'PACK' | 'FORFAIT' | 'TAUX_HORAIRE'
  const [moMinutes, setMoMinutes] = useState(0);
  const [tauxHoraire, setTauxHoraire] = useState(1500);
  const [selectedPieceId, setSelectedPieceId] = useState('');
  const [pieceQuantity, setPieceQuantity] = useState(1);
  const [piecePrice, setPiecePrice] = useState('');
  const [pieceSearchFilter, setPieceSearchFilter] = useState('');

  // Synchroniser la sélection active
  useEffect(() => {
    if (selectedRep) {
      const refreshed = reparations.find(r => r.id === selectedRep.id);
      if (refreshed) {
        setSelectedRep(refreshed);
        setEditForm({ ...refreshed });
      }
    }
  }, [reparations]);

  const openFiche = (rep) => {
    setSelectedRep(rep);
    setEditForm({ ...rep });
    setActiveTab('informations');
    setViewMode('fiche');
  };

  const getAgeInDays = (dateStr) => {
    if (!dateStr) return 0;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('fr-DZ', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  // Sauvegarde globale de TOUTES les données (Modifiable à tout moment et à toutes les étapes)
  const handleSaveAllChanges = async (overrideUpdates = {}) => {
    if (!editForm || !editForm.id) return;
    try {
      setIsSaving(true);
      const updates = {
        ...editForm,
        ...overrideUpdates,
        coutMainOeuvre: Number(overrideUpdates.coutMainOeuvre !== undefined ? overrideUpdates.coutMainOeuvre : editForm.coutMainOeuvre || 0),
        estimationDevis: Number(overrideUpdates.estimationDevis !== undefined ? overrideUpdates.estimationDevis : editForm.estimationDevis || 0),
        acomptePaye: Number(overrideUpdates.acomptePaye !== undefined ? overrideUpdates.acomptePaye : editForm.acomptePaye || 0)
      };

      const res = await api.reparation.update({
        id: editForm.id,
        updates
      }, currentUser);

      if (res.success) {
        showNotification('Données de réparation enregistrées avec succès !');
        setSelectedRep(res.data);
        setEditForm({ ...res.data });
        doRefresh();
      } else {
        showNotification(res.error || 'Erreur lors de l’enregistrement.', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Changement d'étape (Stepper)
  const handleStepChange = async (newStatut) => {
    if (!selectedRep) return;
    if (newStatut === 'LIVRE') {
      setExitModalRep(selectedRep);
      return;
    }
    setEditForm(prev => ({ ...prev, statut: newStatut }));
    await handleSaveAllChanges({ statut: newStatut });
  };

  // Changement rapide de statut (utilisé par Liste, Kanban et Calendrier)
  const handleUpdateStatus = async (repId, newStatus) => {
    try {
      if (newStatus === 'LIVRE') {
        const targetRep = (reparations || []).find(r => r.id === repId) || (selectedRep?.id === repId ? selectedRep : null);
        if (targetRep) {
          setExitModalRep(targetRep);
          return;
        }
      }
      const res = await api.reparation.updateStatus({ id: repId, statut: newStatus }, currentUser);
      if (res.success) {
        showNotification(`Statut mis à jour vers : ${newStatus}`);
        doRefresh();
      } else {
        showNotification(res.error || 'Erreur changement statut', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleKanbanDrop = async (e, targetStatut) => {
    e.preventDefault();
    const repId = e.dataTransfer.getData('text/plain') || draggedRepId;
    if (repId) {
      await handleUpdateStatus(repId, targetStatut);
      setDraggedRepId(null);
    }
  };

  // Ajout de pièce au travail (Déstockage automatique)
  const handleAddPieceWork = async (e) => {
    if (e) e.preventDefault();
    if (!selectedPieceId || !selectedRep) return;
    try {
      const res = await api.reparation.addPiece({
        reparationId: selectedRep.id,
        productId: selectedPieceId,
        quantite: pieceQuantity,
        prixUnitaire: piecePrice ? Number(piecePrice) : null
      }, currentUser);

      if (res.success) {
        window.dispatchEvent(new CustomEvent('app:refresh-data', { detail: { type: 'reparation-piece' } }));
        showNotification('Pièce ajoutée avec succès et déduite du stock.');
        setSelectedRep(res.data);
        setEditForm({ ...res.data });
        setSelectedPieceId('');
        setPieceQuantity(1);
        setPiecePrice('');
        setPieceSearchFilter('');
        doRefresh();
      } else {
        showNotification(res.error || 'Erreur ajout pièce.', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // Retrait de pièce (Restitution en stock)
  const handleRemovePieceWork = async (pieceId) => {
    if (!selectedRep) return;
    try {
      const res = await api.reparation.removePiece({
        pieceId,
        reparationId: selectedRep.id
      }, currentUser);

      if (res.success) {
        window.dispatchEvent(new CustomEvent('app:refresh-data', { detail: { type: 'reparation-piece' } }));
        showNotification('Pièce retirée et réintégrée dans le stock.');
        setSelectedRep(res.data);
        setEditForm({ ...res.data });
        doRefresh();
      } else {
        showNotification(res.error || 'Erreur suppression pièce.', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const KANBAN_COLUMNS = [
    { 
      key: 'RECEPTIONNE', 
      label: 'Reçu', 
      color: 'blue', 
      headerBg: 'bg-blue-50 text-blue-700 border-blue-200', 
      badgeBg: 'bg-blue-100 text-blue-800',
      icon: Clock,
      acceptStatuts: ['RECEPTIONNE']
    },
    { 
      key: 'DIAGNOSTIC', 
      label: 'En diagnostic', 
      color: 'amber', 
      headerBg: 'bg-amber-50 text-amber-700 border-amber-200', 
      badgeBg: 'bg-amber-100 text-amber-800',
      icon: Search,
      acceptStatuts: ['DIAGNOSTIC']
    },
    { 
      key: 'EN_REPARATION', 
      label: 'En réparation', 
      color: 'purple', 
      headerBg: 'bg-purple-50 text-purple-700 border-purple-200', 
      badgeBg: 'bg-purple-100 text-purple-800',
      icon: Wrench,
      acceptStatuts: ['EN_REPARATION', 'ATTENTE_PIECE']
    },
    { 
      key: 'REPARE', 
      label: 'Terminé', 
      color: 'emerald', 
      headerBg: 'bg-emerald-50 text-emerald-700 border-emerald-200', 
      badgeBg: 'bg-emerald-100 text-emerald-800',
      icon: CheckCircle,
      acceptStatuts: ['REPARE', 'IRREPARABLE']
    },
    { 
      key: 'LIVRE', 
      label: 'Livré', 
      color: 'slate', 
      headerBg: 'bg-slate-100 text-slate-700 border-slate-200', 
      badgeBg: 'bg-slate-200 text-slate-800',
      icon: Package,
      acceptStatuts: ['LIVRE', 'RETOUR_GARANTIE']
    }
  ];

  const MONTH_NAMES = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const getCalendarDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const days = [];
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, daysInPrevMonth - i);
      const y = prevDate.getFullYear();
      const m = String(prevDate.getMonth() + 1).padStart(2, '0');
      const d = String(daysInPrevMonth - i).padStart(2, '0');
      days.push({
        date: prevDate,
        dateStr: `${y}-${m}-${d}`,
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: false
      });
    }
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        date: curDate,
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr
      });
    }
    
    const remaining = (7 - (days.length % 7)) % 7;
    for (let n = 1; n <= remaining; n++) {
      const nextDate = new Date(year, month + 1, n);
      const y = nextDate.getFullYear();
      const m = String(nextDate.getMonth() + 1).padStart(2, '0');
      const d = String(n).padStart(2, '0');
      days.push({
        date: nextDate,
        dateStr: `${y}-${m}-${d}`,
        dayNumber: n,
        isCurrentMonth: false,
        isToday: false
      });
    }
    
    return days;
  };

  // Création Nouvel Ordre
  const handleCreateNewOrder = async (e) => {
    e.preventDefault();
    if (!newOrderForm.clientNom.trim()) {
      showNotification('Le nom du client est obligatoire.', 'error');
      return;
    }
    if (!newOrderForm.panneDeclaree.trim()) {
      showNotification('La description de la panne est obligatoire.', 'error');
      return;
    }

    try {
      const acompte = newOrderForm.acomptePayeMaintenant ? Number(newOrderForm.acomptePaye || 0) : 0;
      const res = await api.reparation.create({
        ...newOrderForm,
        acomptePaye: acompte
      }, currentUser);

      if (res.success) {
        showNotification(`Ordre de réparation ${res.data.numeroReparation} créé avec succès !`);
        setIsNewModalOpen(false);
        // Ouvrir directement la fiche nouvellement créée
        setSelectedRep(res.data);
        setEditForm({ ...res.data });
        setViewMode('fiche');
        setActiveTab('informations');
        onRefresh();
      } else {
        showNotification(res.error || 'Erreur création ordre.', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // Impressions
  const handlePrint = async (type) => {
    if (!selectedRep) return;
    if (type === 'etiquette') {
      setIsLabelModalOpen(true);
      return;
    }
    const settings = getPrinterSettings();
    let html = '';
    if (type === 'reception') html = generateRepairReceiptHtml(selectedRep, settings);
    else if (type === 'atelier') html = generateRepairWorkshopSheetHtml(selectedRep, settings);
    else if (type === 'devis') html = generateRepairEstimateHtml(selectedRep, settings);
    else if (type === 'facture' || type === 'livraison') html = generateRepairDeliveryHtml(selectedRep, false, settings);

    await printHtmlContent(html, { silent: true, previewIfFailed: true });
  };

  // Définition des 5 étapes Stepper Photo 505
  const STEPPER_STAGES = [
    { key: 'RECEPTIONNE', label: 'Reçu', icon: Clock },
    { key: 'DIAGNOSTIC', label: 'En diagnostic', icon: Search },
    { key: 'EN_REPARATION', label: 'En réparation', icon: Wrench },
    { key: 'REPARE', label: 'Terminé', icon: CheckCircle },
    { key: 'LIVRE', label: 'Livré', icon: Package }
  ];

  const getStageIndex = (statut) => {
    if (statut === 'RECEPTIONNE') return 0;
    if (statut === 'DIAGNOSTIC') return 1;
    if (statut === 'EN_REPARATION' || statut === 'ATTENTE_PIECE') return 2;
    if (statut === 'REPARE' || statut === 'IRREPARABLE') return 3;
    if (statut === 'LIVRE' || statut === 'RETOUR_GARANTIE') return 4;
    return 0;
  };

  const getInstructionMessage = (statut) => {
    switch (statut) {
      case 'RECEPTIONNE':
        return 'Appareil reçu. Passez en "Diagnostic" pour commencer l\'analyse.';
      case 'DIAGNOSTIC':
        return 'Diagnostic en cours. Déterminez la panne, estimez le coût et préparez les pièces.';
      case 'EN_REPARATION':
      case 'ATTENTE_PIECE':
        return 'Appareil en cours de réparation. Temps de main-d\'œuvre et pièces décomptés en atelier.';
      case 'REPARE':
        return 'Réparation terminée avec succès ! Prêt pour notification client et remise au comptoir.';
      case 'LIVRE':
        return 'Appareil livré au client et règlement validé.';
      case 'IRREPARABLE':
        return 'Appareil déclaré irréparable. Restitution ou établissement d\'un bon de retour.';
      default:
        return 'Fiche d\'intervention active.';
    }
  };

  // Filtrage liste
  const filteredReparations = reparations.filter(r => {
    if (statutFilter !== 'TOUS' && r.statut !== statutFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = (r.numeroReparation || '').toLowerCase().includes(q) ||
                    (r.clientNom || '').toLowerCase().includes(q) ||
                    (r.clientTelephone || '').toLowerCase().includes(q) ||
                    (r.marque || '').toLowerCase().includes(q) ||
                    (r.modele || '').toLowerCase().includes(q) ||
                    (r.panneDeclaree || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-50 select-none overflow-hidden">
      {/* HEADER DINATECK ATELIER */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          {viewMode === 'fiche' && (
            <button
              type="button"
              onClick={() => setViewMode(layoutMode)}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition cursor-pointer"
              title="Retour à la vue précédente"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Réparations</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800">
                  Mode Dinateck Pro
                </span>
              </h2>
            </div>

            {/* SÉLECTEUR DE VUE : Liste / Kanban / Calendrier (IDENTIQUE À LA PHOTO UTILISATEUR) */}
            <div className="mt-1.5 inline-flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-bold text-slate-600 border border-slate-200/60 shadow-2xs">
              <button
                type="button"
                onClick={() => { setLayoutMode('liste'); setViewMode('liste'); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md transition cursor-pointer ${
                  layoutMode === 'liste' && viewMode !== 'fiche'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'hover:text-slate-900 text-slate-600'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Liste</span>
              </button>

              <button
                type="button"
                onClick={() => { setLayoutMode('kanban'); setViewMode('kanban'); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md transition cursor-pointer ${
                  layoutMode === 'kanban' && viewMode !== 'fiche'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'hover:text-slate-900 text-slate-600'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Kanban</span>
              </button>

              <button
                type="button"
                onClick={() => { setLayoutMode('calendrier'); setViewMode('calendrier'); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md transition cursor-pointer ${
                  layoutMode === 'calendrier' && viewMode !== 'fiche'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'hover:text-slate-900 text-slate-600'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Calendrier</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Comptes & Règlements Techniciens */}
          <button
            type="button"
            onClick={() => setIsTechAccountsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-black text-slate-800 bg-white hover:bg-slate-50 shadow-xs transition cursor-pointer"
            title="Consulter les comptes des techniciens, leurs gains et effectuer un versement"
          >
            <Wallet className="w-4 h-4 text-emerald-600" />
            <span>Comptes Techniciens</span>
          </button>

          {/* Bouton de bascule vers le Mode Standard */}
          <button
            type="button"
            onClick={() => onToggleMode('standard')}
            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 transition cursor-pointer"
            title="Basculer vers l'interface Standard en 3 sections"
          >
            Passer en Mode Standard
          </button>

          {/* Bouton Création Nouvelle Réparation */}
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle réparation</span>
            <span className="px-1.5 py-0.2 bg-blue-700 rounded text-[10px]">N</span>
          </button>
        </div>
      </div>

      {/* VUE 1 : LISTE DES RÉPARATIONS (PHOTO 511) */}
      {viewMode === 'liste' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Barre de Recherche & Filtres */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par N° OR, client, appareil, panne..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: 'TOUS', label: 'Tous' },
                { id: 'RECEPTIONNE', label: 'Reçu' },
                { id: 'DIAGNOSTIC', label: 'En diagnostic' },
                { id: 'EN_REPARATION', label: 'En réparation' },
                { id: 'REPARE', label: 'Terminé' },
                { id: 'LIVRE', label: 'Livré' }
              ].map(st => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatutFilter(st.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    statutFilter === st.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tableau Réparations (Photo 511) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Date de réception</th>
                    <th className="px-5 py-3">N° OR</th>
                    <th className="px-5 py-3">Client</th>
                    <th className="px-5 py-3">Appareil</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3 text-center">Statut</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReparations.length > 0 ? (
                    filteredReparations.map((rep) => {
                      const totalTTC = Number(rep.totalTTC || rep.estimationDevis || 0);
                      return (
                        <tr 
                          key={rep.id} 
                          onClick={() => openFiche(rep)}
                          className="hover:bg-blue-50/40 transition cursor-pointer group"
                        >
                          <td className="px-5 py-3.5 text-slate-600 font-medium">
                            {formatDateDisplay(rep.dateReception)}
                          </td>
                          <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                            {rep.numeroReparation}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-800">
                            {rep.clientNom}
                            {rep.clientTelephone && (
                              <span className="block text-[11px] text-slate-400 font-normal">
                                {rep.clientTelephone}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-slate-800">
                            {rep.appareilType} {rep.marque} {rep.modele}
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-slate-900">
                            {totalTTC > 0 ? `${formatCurrencyDz(totalTTC)} DA` : '-'}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              rep.statut === 'RECEPTIONNE' ? 'bg-blue-100 text-blue-800' :
                              rep.statut === 'DIAGNOSTIC' ? 'bg-purple-100 text-purple-800' :
                              rep.statut === 'EN_REPARATION' || rep.statut === 'ATTENTE_PIECE' ? 'bg-amber-100 text-amber-800' :
                              rep.statut === 'REPARE' ? 'bg-emerald-100 text-emerald-800' :
                              rep.statut === 'LIVRE' ? 'bg-slate-200 text-slate-700' :
                              'bg-rose-100 text-rose-800'
                            }`}>
                              {rep.statut === 'RECEPTIONNE' ? 'Reçu' :
                               rep.statut === 'DIAGNOSTIC' ? 'En diagnostic' :
                               rep.statut === 'EN_REPARATION' ? 'En réparation' :
                               rep.statut === 'ATTENTE_PIECE' ? 'Attente pièce' :
                               rep.statut === 'REPARE' ? 'Terminé' :
                               rep.statut === 'LIVRE' ? 'Livré' : rep.statut}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <select
                                value={rep.statut}
                                onChange={async (e) => {
                                  const newSt = e.target.value;
                                  await api.reparation.update({ id: rep.id, updates: { statut: newSt } }, currentUser);
                                  onRefresh();
                                }}
                                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-blue-500"
                              >
                                <option value="RECEPTIONNE">Reçu</option>
                                <option value="DIAGNOSTIC">En diagnostic</option>
                                <option value="EN_REPARATION">En réparation</option>
                                <option value="REPARE">Terminé</option>
                                <option value="LIVRE">Livré</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => openFiche(rep)}
                                className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold transition"
                              >
                                Fiche
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-semibold">
                        Aucun ordre de réparation trouvé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VUE KANBAN : 5 COLONNES DINATECK INTERACTIVES AVEC DRAG & DROP ET STATUTS */}
      {viewMode === 'kanban' && (
        <div className="flex-1 flex flex-col min-h-0 p-6 space-y-4 overflow-hidden">
          {/* Barre de Recherche & Filtres rapides */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par N° OR, client, appareil, panne..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
              <span className="font-bold text-slate-700">Guide Kanban :</span>
              <span>Glissez-déposez les cartes d'une colonne à une autre ou utilisez les flèches pour changer d'étape</span>
            </div>
          </div>

          {/* 5 Colonnes Kanban */}
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 overflow-x-auto pb-2">
            {KANBAN_COLUMNS.map((col, colIdx) => {
              const colReps = filteredReparations.filter(r => col.acceptStatuts.includes(r.statut));
              const totalColDA = colReps.reduce((sum, r) => sum + Number(r.totalTTC || r.estimationDevis || 0), 0);
              const ColIcon = col.icon;

              return (
                <div
                  key={col.key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleKanbanDrop(e, col.key)}
                  className="flex flex-col h-full bg-slate-100/70 border border-slate-200 rounded-2xl overflow-hidden min-w-[240px]"
                >
                  {/* Entête de Colonne */}
                  <div className={`p-3 border-b flex items-center justify-between gap-2 shrink-0 ${col.headerBg}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <ColIcon className="w-4 h-4 shrink-0" />
                      <span className="font-black text-xs truncate">{col.label}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${col.badgeBg}`}>
                      {colReps.length}
                    </span>
                  </div>

                  {/* Sous-entête : montant cumulé */}
                  <div className="px-3 py-1.5 bg-white/80 border-b border-slate-200/60 flex items-center justify-between text-[10px] font-bold text-slate-500 shrink-0">
                    <span>Total prévu :</span>
                    <span className="font-black text-slate-700">{formatCurrencyDz(totalColDA)}</span>
                  </div>

                  {/* Zone de cartes défilable */}
                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                    {colReps.length > 0 ? (
                      colReps.map(rep => {
                        const total = Number(rep.totalTTC || rep.estimationDevis || 0);
                        const acompte = Number(rep.acomptePaye || 0);
                        const isUrgente = rep.priorite === 'Urgente';
                        const ageDays = getAgeInDays(rep.dateReception);

                        return (
                          <div
                            key={rep.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', rep.id);
                              setDraggedRepId(rep.id);
                            }}
                            className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-2xs hover:shadow-md hover:border-blue-400 transition cursor-grab active:cursor-grabbing group relative select-none"
                          >
                            {/* Card Header : N° OR + Badge Âge/Priorité */}
                            <div className="flex items-center justify-between gap-1.5 mb-1.5">
                              <span 
                                onClick={() => openFiche(rep)}
                                className="font-mono font-black text-xs text-blue-600 hover:underline cursor-pointer"
                              >
                                {rep.numeroReparation}
                              </span>
                              <div className="flex items-center gap-1">
                                {isUrgente && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-100 text-rose-700">
                                    Urgent
                                  </span>
                                )}
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-500">
                                  {ageDays} j
                                </span>
                              </div>
                            </div>

                            {/* Client & Contact */}
                            <div 
                              onClick={() => openFiche(rep)}
                              className="text-xs font-bold text-slate-800 truncate mb-0.5 cursor-pointer hover:text-blue-600"
                            >
                              {rep.clientNom || 'Client anonyme'}
                            </div>
                            {rep.clientTelephone && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-2 font-mono">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{rep.clientTelephone}</span>
                              </div>
                            )}

                            {/* Appareil & Panne */}
                            <div 
                              onClick={() => openFiche(rep)}
                              className="bg-slate-50 rounded-lg p-2 mb-2 border border-slate-100 cursor-pointer hover:bg-blue-50/30 transition"
                            >
                              <div className="text-[11px] font-bold text-slate-700 truncate flex items-center gap-1">
                                <Smartphone className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{rep.marque} {rep.modele || rep.appareilType}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
                                {rep.panneDeclaree || 'Panne non précisée'}
                              </p>
                            </div>

                            {/* Données financières : Total & Acompte */}
                            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 mb-2">
                              <div>
                                <span className="text-[10px] text-slate-400 block font-semibold">Total</span>
                                <span className="font-black text-slate-900">{formatCurrencyDz(total)}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block font-semibold">Acompte</span>
                                <span className={`font-bold ${acompte > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  {acompte > 0 ? formatCurrencyDz(acompte) : '0 DA'}
                                </span>
                              </div>
                            </div>

                            {/* Barre d'actions & Navigation d'étape */}
                            <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100/80">
                              <button
                                type="button"
                                disabled={colIdx === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (colIdx > 0) handleUpdateStatus(rep.id, KANBAN_COLUMNS[colIdx - 1].key);
                                }}
                                className={`p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition ${colIdx === 0 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
                                title="Étape précédente"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => openFiche(rep)}
                                className="px-2 py-0.5 rounded text-[11px] font-bold text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                              >
                                Fiche atelier
                              </button>

                              <button
                                type="button"
                                disabled={colIdx === KANBAN_COLUMNS.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (colIdx < KANBAN_COLUMNS.length - 1) handleUpdateStatus(rep.id, KANBAN_COLUMNS[colIdx + 1].key);
                                }}
                                className={`p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition ${colIdx === KANBAN_COLUMNS.length - 1 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
                                title="Étape suivante"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-[11px] text-slate-400 font-semibold border-2 border-dashed border-slate-200/60 rounded-xl">
                        Aucun dossier à cette étape
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VUE CALENDRIER : PLANIFICATION DES DÉLAIS ET DATE DE RÉCEPTION */}
      {viewMode === 'calendrier' && (
        <div className="flex-1 flex flex-col min-h-0 p-6 space-y-4 overflow-hidden">
          {/* Header Calendrier avec Navigation de Mois et Statistiques */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition cursor-pointer"
                  title="Mois précédent"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarDate(new Date())}
                  className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-white rounded-lg transition cursor-pointer"
                >
                  Aujourd'hui
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition cursor-pointer"
                  title="Mois suivant"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <h3 className="text-base font-black text-slate-900 tracking-tight">
                {MONTH_NAMES[calendarDate.getMonth()]} {calendarDate.getFullYear()}
              </h3>
            </div>

            {/* Badges Synthèse Mensuelle */}
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                {reparations.length} total dossiers
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                {reparations.filter(r => r.statut !== 'LIVRE').length} en atelier
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                {reparations.filter(r => r.statut === 'REPARE').length} prêts à livrer
              </span>
            </div>
          </div>

          {/* Grille du Calendrier */}
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
            {/* Ligne des jours de la semaine */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-600 py-2.5 shrink-0">
              {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(day => (
                <div key={day}>{day}</div>
              ))}
            </div>

            {/* Cases des jours */}
            <div className="flex-1 grid grid-cols-7 divide-x divide-y divide-slate-100 overflow-y-auto auto-rows-fr">
              {getCalendarDays(calendarDate).map((dayObj, dIdx) => {
                const dayReps = filteredReparations.filter(r => {
                  const repDelai = r.delaiEstime ? String(r.delaiEstime).split('T')[0] : '';
                  const repRecep = r.dateReception ? String(r.dateReception).split('T')[0] : '';
                  return repDelai === dayObj.dateStr || repRecep === dayObj.dateStr;
                });

                return (
                  <div
                    key={dIdx}
                    className={`min-h-[105px] p-2 flex flex-col transition group ${
                      dayObj.isCurrentMonth ? 'bg-white' : 'bg-slate-50/40 text-slate-400'
                    } ${dayObj.isToday ? 'bg-blue-50/30' : ''}`}
                  >
                    {/* Header de la case jour */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-black inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        dayObj.isToday
                          ? 'bg-blue-600 text-white shadow-xs'
                          : dayObj.isCurrentMonth
                            ? 'text-slate-800'
                            : 'text-slate-400'
                      }`}>
                        {dayObj.dayNumber}
                      </span>

                      {/* Bouton + pour ajouter directement un ordre à cette date */}
                      <button
                        type="button"
                        onClick={() => {
                          setNewOrderForm(prev => ({ ...prev, delaiEstime: dayObj.dateStr }));
                          setIsNewModalOpen(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 px-1.5 rounded bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 transition cursor-pointer text-[10px] font-bold"
                        title={`Nouveau dossier prévu le ${dayObj.dateStr}`}
                      >
                        +
                      </button>
                    </div>

                    {/* Liste des réparations pour ce jour */}
                    <div className="flex-1 overflow-y-auto space-y-1">
                      {dayReps.slice(0, 3).map(rep => {
                        let statusColor = 'bg-blue-100 text-blue-800 border-blue-200';
                        if (rep.statut === 'DIAGNOSTIC') statusColor = 'bg-amber-100 text-amber-800 border-amber-200';
                        if (rep.statut === 'EN_REPARATION') statusColor = 'bg-purple-100 text-purple-800 border-purple-200';
                        if (rep.statut === 'REPARE') statusColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                        if (rep.statut === 'LIVRE') statusColor = 'bg-slate-100 text-slate-700 border-slate-200';

                        return (
                          <div
                            key={rep.id}
                            onClick={() => openFiche(rep)}
                            className={`px-1.5 py-1 rounded text-[10px] font-bold border truncate cursor-pointer hover:scale-[1.02] transition shadow-2xs ${statusColor}`}
                            title={`${rep.numeroReparation} - ${rep.clientNom} - ${rep.marque} ${rep.modele}`}
                          >
                            <span className="font-mono">{rep.numeroReparation}</span> : {rep.modele || rep.clientNom}
                          </div>
                        );
                      })}
                      {dayReps.length > 3 && (
                        <div className="text-[9px] font-black text-slate-500 text-center">
                          +{dayReps.length - 3} autres
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VUE 2 : FICHE COMPLÈTE DE RÉPARATION DINATECK (PHOTOS 505 À 509) */}
      {viewMode === 'fiche' && selectedRep && editForm && (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Top Bar : Statut & Priorité */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500">Statut :</span>
              <select
                value={editForm.statut}
                onChange={(e) => handleStepChange(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-blue-500"
              >
                <option value="RECEPTIONNE">⏱ Reçu</option>
                <option value="DIAGNOSTIC">🔍 En diagnostic</option>
                <option value="EN_REPARATION">🔧 En réparation</option>
                <option value="ATTENTE_PIECE">📦 Attente pièce</option>
                <option value="REPARE">✓ Terminé</option>
                <option value="LIVRE">🚚 Livré</option>
                <option value="IRREPARABLE">✕ Irréparable</option>
              </select>

              <span className="text-xs font-bold text-slate-500 ml-2">Priorité :</span>
              <select
                value={editForm.priorite || 'Normale'}
                onChange={(e) => setEditForm({ ...editForm, priorite: e.target.value })}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-blue-500"
              >
                <option value="Basse">Basse</option>
                <option value="Normale">Normale</option>
                <option value="Haute">Haute</option>
                <option value="Urgente">⚡ Urgente</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExitModalRep(selectedRep)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition shadow-md cursor-pointer"
                title="Valider la sortie et l'encaissement du téléphone"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Valider Sortie Téléphone</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveAllChanges()}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Enregistrement...' : 'Enregistrer'}</span>
              </button>
            </div>
          </div>

          {/* Stepper 5 Étapes (Photo 505) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="relative flex items-center justify-between max-w-3xl mx-auto px-4">
              {/* Ligne grise en arrière-plan */}
              <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0" />
              
              {STEPPER_STAGES.map((st, idx) => {
                const currentIdx = getStageIndex(editForm.statut);
                const isPassed = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const Icon = st.icon;

                return (
                  <div key={st.key} className="relative z-10 flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => handleStepChange(st.key)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition cursor-pointer shadow-xs ${
                        isCurrent 
                          ? 'bg-blue-600 text-white ring-4 ring-blue-100 scale-110' 
                          : isPassed 
                            ? 'bg-slate-800 text-white hover:bg-slate-700' 
                            : 'bg-white border-2 border-slate-300 text-slate-400 hover:border-slate-400'
                      }`}
                      title={`Passer à l'étape : ${st.label}`}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                    <span className={`text-[11px] font-black mt-2 ${isCurrent ? 'text-blue-700' : 'text-slate-600'}`}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bannière d'instruction contextualisée (Photo 505) */}
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl text-xs font-bold text-blue-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{getInstructionMessage(editForm.statut)}</span>
            </div>
          </div>

          {/* 4 Cards résumées (Photo 505) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1 : Coût total HT */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">$ Coût total HT</span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatCurrencyDz(Number(editForm.totalTTC || 0))} DA
              </div>
              <div className="text-[10px] text-slate-400 font-semibold mt-1 space-y-0.5">
                <div>Pièces utilisées : {formatCurrencyDz(Number(editForm.coutPieces || 0))} DA</div>
                <div>M.O : {formatCurrencyDz(Number(editForm.coutMainOeuvre || 0))} DA ({moMinutes} min)</div>
              </div>
            </div>

            {/* Card 2 : Technicien */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Technicien</span>
              <div className="flex items-center gap-2.5 mt-2">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-black flex items-center justify-center text-xs">
                  {(editForm.reparateurNom || 'M')[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <select
                    value={editForm.reparateur_id || ''}
                    onChange={(e) => {
                      const tech = technicians.find(t => String(t.id) === e.target.value);
                      setEditForm({
                        ...editForm,
                        reparateur_id: tech ? tech.id : '',
                        reparateurNom: tech ? tech.nom : ''
                      });
                    }}
                    className="w-full bg-transparent font-black text-xs text-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="">Non assigné</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>{t.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Card 3 : Acompte */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Acompte</span>
              <div className="text-base font-black text-slate-800 mt-1">
                demandés : {formatCurrencyDz(Number(editForm.estimationDevis || editForm.acomptePaye || 0))} DA
              </div>
              <span className="text-[10px] font-bold text-slate-400 mt-1 block">
                {Number(editForm.acomptePaye) > 0 ? `(encaissé: ${formatCurrencyDz(editForm.acomptePaye)} DA)` : '(non encaissé)'}
              </span>
            </div>

            {/* Card 4 : Âge en jours */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Âge</span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {getAgeInDays(editForm.dateReception)} jours
              </div>
              <span className="text-[10px] text-slate-400 font-semibold mt-1 block">
                Depuis le {formatDateDisplay(editForm.dateReception)}
              </span>
            </div>
          </div>

          {/* 5 ONGLETS SECONDAIRES (PHOTO 505) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="flex items-center gap-1 border-b border-slate-200 px-4 pt-2 bg-slate-50/50">
              {[
                { id: 'informations', label: 'Informations', icon: AlertCircle },
                { id: 'documents', label: 'Documents', icon: FileText },
                { id: 'travaux', label: 'Travaux', icon: Wrench },
                { id: 'financier', label: 'Financier', icon: DollarSign },
                { id: 'historique', label: 'Historique', icon: History }
              ].map(tb => {
                const Icon = tb.icon;
                const isActive = activeTab === tb.id;
                return (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => setActiveTab(tb.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-black border-b-2 transition cursor-pointer ${
                      isActive 
                        ? 'border-blue-600 text-blue-600 bg-white' 
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tb.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-6">
              {/* TAB 1 : INFORMATIONS (PHOTO 507) - TOUT EST MODIFIABLE LIBREMENT */}
              {activeTab === 'informations' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* 4 Boîtes de Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Date de réception</span>
                      <span className="text-xs font-black text-slate-800 mt-1 block">
                        {formatDateDisplay(editForm.dateReception)}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Délai estimé</span>
                      <input
                        type="date"
                        value={editForm.delaiEstime || ''}
                        onChange={(e) => setEditForm({ ...editForm, delaiEstime: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold mt-1"
                      />
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Date terminée</span>
                      <span className="text-xs font-black text-slate-800 mt-1 block">
                        {formatDateDisplay(editForm.dateReparation)}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Date livrée</span>
                      <span className="text-xs font-black text-slate-800 mt-1 block">
                        {formatDateDisplay(editForm.dateLivraison)}
                      </span>
                    </div>
                  </div>

                  {/* 2 Cartes : Client & Appareil */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Carte Client */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      <div className="font-black text-xs text-slate-900 uppercase flex items-center gap-1.5 border-b border-slate-200 pb-2">
                        <User className="w-4 h-4 text-blue-600" />
                        <span>Client</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Nom du Client</label>
                          <input
                            type="text"
                            value={editForm.clientNom || ''}
                            onChange={(e) => setEditForm({ ...editForm, clientNom: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Téléphone</label>
                          <input
                            type="text"
                            value={editForm.clientTelephone || ''}
                            onChange={(e) => setEditForm({ ...editForm, clientTelephone: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Carte Appareil */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      <div className="font-black text-xs text-slate-900 uppercase flex items-center gap-1.5 border-b border-slate-200 pb-2">
                        <Smartphone className="w-4 h-4 text-purple-600" />
                        <span>Appareil</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Marque</label>
                          <input
                            type="text"
                            value={editForm.marque || ''}
                            onChange={(e) => setEditForm({ ...editForm, marque: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Modèle</label>
                          <input
                            type="text"
                            value={editForm.modele || ''}
                            onChange={(e) => setEditForm({ ...editForm, modele: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">N° Série / IMEI</label>
                          <input
                            type="text"
                            value={editForm.numeroSerie || ''}
                            onChange={(e) => setEditForm({ ...editForm, numeroSerie: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">PIN / Déverrouillage</label>
                          <input
                            type="text"
                            value={editForm.motDePasseAppareil || ''}
                            onChange={(e) => setEditForm({ ...editForm, motDePasseAppareil: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-blue-600 font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Symptômes déclarés (Photo 507) */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <span className="font-black text-xs text-slate-900 uppercase block">Symptômes déclarés</span>
                    <textarea
                      rows={2}
                      value={editForm.panneDeclaree || ''}
                      onChange={(e) => setEditForm({ ...editForm, panneDeclaree: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                    />
                  </div>

                  {/* Réception & Accessoires (Photo 514) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-black text-xs text-slate-900 uppercase block">État de réception</span>
                      <input
                        type="text"
                        value={editForm.etatReception || ''}
                        onChange={(e) => setEditForm({ ...editForm, etatReception: e.target.value })}
                        placeholder="Ex: Bon état, écran rayé, fissure..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                      />
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-black text-xs text-slate-900 uppercase block">Accessoires reçus</span>
                      <input
                        type="text"
                        value={editForm.accessoires || ''}
                        onChange={(e) => setEditForm({ ...editForm, accessoires: e.target.value })}
                        placeholder="Ex: Sans accessoire, chargeur..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                      />
                    </div>
                  </div>

                  {/* Notes internes */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <span className="font-black text-xs text-slate-900 uppercase block">Notes internes (Équipe)</span>
                    <textarea
                      rows={2}
                      value={editForm.notes || ''}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Ajouter des notes internes pour l'équipe..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>

                  {/* Bouton Enregistrer Modifications Informations */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => handleSaveAllChanges()}
                      disabled={isSaving}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 transition cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSaving ? 'Enregistrement...' : 'Sauvegarder toutes les modifications'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2 : TRAVAUX (PHOTO 509) - MODE TARIFICATION, MO & PIÈCES UTILISÉES */}
              {activeTab === 'travaux' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Mode de Tarification */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <span className="font-black text-xs text-slate-900 uppercase block">Mode de tarification</span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'PACK', label: 'Pack' },
                        { id: 'FORFAIT', label: 'Forfait' },
                        { id: 'TAUX_HORAIRE', label: 'Taux horaire' }
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMoMode(m.id)}
                          className={`py-2 rounded-xl text-xs font-black transition cursor-pointer border ${
                            moMode === m.id
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Temps de main-d'œuvre & Coût MO */}
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-slate-900 uppercase flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span>Temps de main-d'œuvre</span>
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        Taux horaire : {tauxHoraire} DA/h
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setMoMinutes(Math.max(0, moMinutes - 15))}
                          className="px-2.5 py-1 bg-white hover:bg-slate-200 rounded-lg font-black text-xs cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-3 font-mono font-black text-xs">{moMinutes} min</span>
                        <button
                          type="button"
                          onClick={() => setMoMinutes(moMinutes + 15)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-200 rounded-lg font-black text-xs cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMoMinutes(moMinutes + 15)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          +15 min
                        </button>
                        <button
                          type="button"
                          onClick={() => setMoMinutes(moMinutes + 30)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          +30 min
                        </button>
                        <button
                          type="button"
                          onClick={() => setMoMinutes(moMinutes + 60)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          +1h
                        </button>
                      </div>

                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">Coût MO fixé :</span>
                        <input
                          type="number"
                          min="0"
                          value={editForm.coutMainOeuvre || 0}
                          onChange={(e) => setEditForm({ ...editForm, coutMainOeuvre: Number(e.target.value) })}
                          className="w-28 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 text-xs text-right focus:bg-white"
                        />
                        <span className="text-xs font-black text-slate-700">DA</span>
                      </div>
                    </div>
                  </div>

                  {/* Pièces Utilisées (Photo 509) */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-slate-900 uppercase flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-indigo-600" />
                        <span>Pièces utilisées (Déstockage direct)</span>
                      </span>
                      <span className="text-[11px] text-emerald-600 font-bold">
                        ✓ Aucune restriction : ajout et retrait libres
                      </span>
                    </div>

                    {/* Formulaire Ajout Pièce avec suggestion disponibilité */}
                    <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex-1 min-w-[240px]">
                        <PieceSearchAutocomplete
                          products={stockProducts}
                          selectedProductId={selectedPieceId}
                          onSelectProduct={(prod) => {
                            if (prod) {
                              setSelectedPieceId(String(prod._id || prod.id));
                              setPiecePrice(String(prod.prixVente || 0));
                            } else {
                              setSelectedPieceId('');
                              setPiecePrice('');
                            }
                          }}
                          placeholder="Rechercher une pièce par nom, réf ou scanner..."
                        />
                      </div>

                      <div className="w-20">
                        <input
                          type="number"
                          min="1"
                          value={pieceQuantity}
                          onChange={(e) => setPieceQuantity(Number(e.target.value))}
                          placeholder="Qté"
                          className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center focus:bg-white focus:outline-blue-500"
                        />
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          min="0"
                          value={piecePrice}
                          onChange={(e) => setPiecePrice(e.target.value)}
                          placeholder="Prix unitaire"
                          className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-right focus:bg-white focus:outline-blue-500"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddPieceWork}
                        disabled={!selectedPieceId}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs shrink-0"
                      >
                        + Ajouter pièce
                      </button>
                    </div>

                    {/* Tableau des pièces ajoutées */}
                    {selectedRep.pieces && selectedRep.pieces.length > 0 ? (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-2.5">Pièce</th>
                              <th className="px-4 py-2.5 text-center">Quantité</th>
                              <th className="px-4 py-2.5 text-right">P.U (DA)</th>
                              <th className="px-4 py-2.5 text-right">Total (DA)</th>
                              <th className="px-4 py-2.5 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedRep.pieces.map((p) => (
                              <tr key={p.id}>
                                <td className="px-4 py-2.5 font-bold text-slate-900">{p.nom}</td>
                                <td className="px-4 py-2.5 text-center font-bold">{p.quantite}</td>
                                <td className="px-4 py-2.5 text-right font-semibold">{formatCurrencyDz(p.prixUnitaire)} DA</td>
                                <td className="px-4 py-2.5 text-right font-black text-blue-600">
                                  {formatCurrencyDz(Number(p.quantite) * Number(p.prixUnitaire))} DA
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePieceWork(p.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                    title="Supprimer la pièce et restituer en stock"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                        Aucune pièce utilisée pour l'instant.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3 : FINANCIER (PHOTO 506) */}
              {activeTab === 'financier' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Récapitulatif Financier */}
                  <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
                    <span className="font-black text-xs text-slate-900 uppercase block border-b border-slate-100 pb-2">
                      Récapitulatif financier
                    </span>

                    <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-700">
                      <div className="flex justify-between p-2 bg-slate-50 rounded-xl">
                        <span>Pièces utilisées :</span>
                        <span className="font-black text-slate-900">{formatCurrencyDz(Number(editForm.coutPieces || 0))} DA</span>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-50 rounded-xl">
                        <span>Main d'œuvre :</span>
                        <span className="font-black text-slate-900">{formatCurrencyDz(Number(editForm.coutMainOeuvre || 0))} DA</span>
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl flex items-center justify-between text-sm font-black text-blue-900">
                      <span>Total HT / TTC :</span>
                      <span className="text-lg">{formatCurrencyDz(Number(editForm.totalTTC || 0))} DA</span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-t border-slate-100 pt-3">
                      <div>
                        <span>Acompte sur devis ({formatCurrencyDz(Number(editForm.estimationDevis || editForm.acomptePaye || 0))} DA) :</span>
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-black ${
                          Number(editForm.acomptePaye) > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {Number(editForm.acomptePaye) > 0 ? 'Encaissé' : 'Non encaissé'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-emerald-700 font-black">{formatCurrencyDz(Number(editForm.acomptePaye || 0))} DA</span>
                      </div>
                    </div>
                  </div>

                  {/* Résumé des acomptes */}
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <span className="font-black text-xs text-slate-900 uppercase block">Résumé des acomptes & encaissements</span>
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 block">Acompte demandé / versé :</span>
                        <input
                          type="number"
                          min="0"
                          value={editForm.acomptePaye || 0}
                          onChange={(e) => setEditForm({ ...editForm, acomptePaye: Number(e.target.value) })}
                          className="mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-emerald-700 text-base w-36"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveAllChanges()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer"
                      >
                        Valider l'acompte
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4 : DOCUMENTS (PHOTO 508) */}
              {activeTab === 'documents' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* 1. Bon de Réception */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                          <FileText className="w-5 h-5" />
                        </div>
                        <h4 className="font-black text-xs text-slate-900 uppercase">Bon de Réception</h4>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Documentez la prise en charge de l'équipement client avec clauses.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePrint('reception')}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Générer bon de réception</span>
                      </button>
                    </div>

                    {/* 2. Fiche de Réparation (Atelier) */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
                          <Wrench className="w-5 h-5" />
                        </div>
                        <h4 className="font-black text-xs text-slate-900 uppercase">Fiche Réparation Atelier</h4>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Fiche technique interne de suivi pour le technicien.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePrint('atelier')}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimer fiche atelier</span>
                      </button>
                    </div>

                    {/* 3. Devis Estimatif */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <h4 className="font-black text-xs text-slate-900 uppercase">Devis Client</h4>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Devis officiel avant travaux pour accord client.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePrint('devis')}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Générer le devis</span>
                      </button>
                    </div>

                    {/* 4. Facture Finale / Bon de Livraison */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <h4 className="font-black text-xs text-slate-900 uppercase">Facture Finale / Remise</h4>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Facture complète avec pièces et garantie atelier de 30 jours.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePrint('facture')}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Générer la facture</span>
                      </button>
                    </div>

                    {/* 5. Étiquette Code-Barres Xprinter */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-2">
                          <Tag className="w-5 h-5" />
                        </div>
                        <h4 className="font-black text-xs text-slate-900 uppercase">Étiquette Adhésive</h4>
                        <p className="text-[11px] text-slate-500 mt-1">
                          À coller directement sur l'appareil (Xprinter 350B).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePrint('etiquette')}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimer étiquette</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5 : HISTORIQUE */}
              {activeTab === 'historique' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="font-black text-xs text-slate-900 uppercase block mb-3">
                      Historique de l'équipement & interventions
                    </span>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center gap-2 text-slate-700 font-bold">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span>Réceptionné le {formatDateDisplay(editForm.dateReception)}</span>
                      </div>
                      {editForm.dateDiagnostic && (
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                          <Search className="w-4 h-4 text-purple-600" />
                          <span>Diagnostic établi le {formatDateDisplay(editForm.dateDiagnostic)}</span>
                        </div>
                      )}
                      {editForm.dateReparation && (
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                          <Wrench className="w-4 h-4 text-amber-600" />
                          <span>Travaux terminés le {formatDateDisplay(editForm.dateReparation)}</span>
                        </div>
                      )}
                      {editForm.dateLivraison && (
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span>Restitué au client le {formatDateDisplay(editForm.dateLivraison)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOUVEL ORDRE DE RÉPARATION (PHOTOS 512, 514, 515) */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Nouvel ordre de réparation"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateNewOrder} className="space-y-4 text-xs">
          {/* Section 1 : Client & Appareil (Photo 515) */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <span className="font-black text-slate-900 uppercase flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>Client & Appareil</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Client *</label>
                <input
                  type="text"
                  required
                  value={newOrderForm.clientNom}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, clientNom: e.target.value })}
                  placeholder="Nom du client (ex: Mohamed)"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold focus:outline-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Téléphone</label>
                <input
                  type="text"
                  value={newOrderForm.clientTelephone}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, clientTelephone: e.target.value })}
                  placeholder="Ex: 0550245000"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold focus:outline-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Marque Appareil *</label>
                <input
                  type="text"
                  required
                  value={newOrderForm.marque}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, marque: e.target.value.toUpperCase() })}
                  placeholder="Ex: SAMSUNG, APPLE, XIAOMI"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold focus:outline-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Modèle Appareil *</label>
                <input
                  type="text"
                  required
                  value={newOrderForm.modele}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, modele: e.target.value })}
                  placeholder="Ex: A16, REDMI 9"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold focus:outline-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2 : Symptômes déclarés (Photo 515) */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-900 uppercase">Symptômes déclarés *</span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={newOrderForm.sousGarantie}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, sousGarantie: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span>Sous garantie</span>
              </label>
            </div>
            <textarea
              required
              rows={2}
              value={newOrderForm.panneDeclaree}
              onChange={(e) => setNewOrderForm({ ...newOrderForm, panneDeclaree: e.target.value })}
              placeholder="Décrivez les symptômes rapportés par le client (ex: Afficheur noir, batterie gonflée)..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold focus:outline-blue-500"
            />
          </div>

          {/* Section 3 : Urgence & Planning (Photo 515) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Priorité</label>
              <select
                value={newOrderForm.priorite}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, priorite: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white"
              >
                <option value="Basse">Basse</option>
                <option value="Normale">Normale</option>
                <option value="Haute">Haute</option>
                <option value="Urgente">⚡ Urgente</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Délai estimé</label>
              <input
                type="date"
                value={newOrderForm.delaiEstime}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, delaiEstime: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Technicien</label>
              <select
                value={newOrderForm.reparateur_id}
                onChange={(e) => {
                  const tech = technicians.find(t => String(t.id) === e.target.value);
                  setNewOrderForm({
                    ...newOrderForm,
                    reparateur_id: tech ? tech.id : '',
                    reparateurNom: tech ? tech.nom : ''
                  });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white"
              >
                <option value="">Non assigné</option>
                {technicians.map(t => (
                  <option key={t.id} value={t.id}>{t.nom}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 4 : Réception & Acompte (Photo 512) */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <span className="font-black text-slate-900 uppercase block">Réception & Acompte</span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">État réception</label>
                <input
                  type="text"
                  value={newOrderForm.etatReception}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, etatReception: e.target.value })}
                  placeholder="Ex: Bon état"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Accessoires reçus</label>
                <input
                  type="text"
                  value={newOrderForm.accessoires}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, accessoires: e.target.value })}
                  placeholder="Ex: Chargeur, coque..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Acompte demandé (indicatif)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    value={newOrderForm.estimationDevis}
                    onChange={(e) => setNewOrderForm({ 
                      ...newOrderForm, 
                      estimationDevis: e.target.value,
                      acomptePaye: newOrderForm.acomptePayeMaintenant ? e.target.value : newOrderForm.acomptePaye 
                    })}
                    placeholder="0"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-black text-slate-900"
                  />
                  <span className="font-bold text-slate-500">DA</span>
                </div>
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={newOrderForm.acomptePayeMaintenant}
                    onChange={(e) => setNewOrderForm({ 
                      ...newOrderForm, 
                      acomptePayeMaintenant: e.target.checked,
                      acomptePaye: e.target.checked ? (newOrderForm.estimationDevis || '0') : ''
                    })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Le client a payé un acompte maintenant</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-md shadow-blue-500/20 cursor-pointer"
            >
              Créer
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Prévisualisation & Impression Étiquette Thermique SAV */}
      <RepairLabelModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        reparation={selectedRep}
      />

      {/* Modal Comptes & Règlements des Techniciens */}
      <TechniciansAccountsModal
        isOpen={isTechAccountsModalOpen}
        onClose={() => setIsTechAccountsModalOpen(false)}
        currentUser={currentUser}
        onUpdated={loadData}
      />

      {/* Modal Validation Sortie Téléphone & Règlement Atelier */}
      <RepairExitModal
        isOpen={!!exitModalRep}
        onClose={() => setExitModalRep(null)}
        reparation={exitModalRep}
        caisses={caisses}
        currentUser={currentUser}
        onSuccess={(updatedRep) => {
          showNotification('Sortie du téléphone validée avec succès !');
          doRefresh();
          if (selectedRep && selectedRep.id === updatedRep.id) {
            setSelectedRep(updatedRep);
            setEditForm(updatedRep);
          }
        }}
      />
    </div>
  );
}
