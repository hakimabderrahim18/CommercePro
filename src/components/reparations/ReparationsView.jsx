import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  Wrench, 
  Plus, 
  Search, 
  Printer, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Package, 
  User, 
  Trash2, 
  Edit, 
  Send, 
  RotateCcw, 
  FileText, 
  Tag, 
  Smartphone, 
  Laptop, 
  Layers, 
  Check, 
  DollarSign, 
  Wallet,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import Modal from '../common/Modal';
import RepairLabelModal from './RepairLabelModal';
import DinateckRepairView from './DinateckRepairView';
import TechniciansAccountsModal from './TechniciansAccountsModal';
import PieceSearchAutocomplete from './PieceSearchAutocomplete';
import RepairExitModal from './RepairExitModal';
import { printHtmlContent, getPrinterSettings, savePrinterSettings } from '../../utils/printerHelper';
import { 
  generateRepairLabelHtml, 
  printRepairLabel,
  generateRepairReceiptHtml, 
  generateRepairDeliveryHtml 
} from '../../utils/repairPrinterHelper';

export default function ReparationsView() {
  const { currentUser, isReparateur } = useAuth();
  
  // Mode du workflow SAV : 'dinateck' (interface pro avec stepper 5 étapes) ou 'standard' (3 onglets)
  const [workflowMode, setWorkflowMode] = useState(() => {
    return getPrinterSettings().repairWorkflowMode || 'dinateck';
  });

  useEffect(() => {
    const handleSettingsChanged = (e) => {
      const mode = e?.detail?.repairWorkflowMode || getPrinterSettings().repairWorkflowMode || 'dinateck';
      setWorkflowMode(mode);
    };
    window.addEventListener('printer-settings-changed', handleSettingsChanged);
    return () => window.removeEventListener('printer-settings-changed', handleSettingsChanged);
  }, []);

  const handleToggleMode = (newMode) => {
    const target = newMode || (workflowMode === 'dinateck' ? 'standard' : 'dinateck');
    setWorkflowMode(target);
    const curr = getPrinterSettings();
    savePrinterSettings({ ...curr, repairWorkflowMode: target });
    showNotification(`Mode SAV basculé vers : ${target === 'dinateck' ? 'Dinateck Pro' : 'Standard'}`);
  };
  
  // Section active : 'reception' | 'atelier' | 'livraison'
  const [activeSection, setActiveSection] = useState('atelier');
  const [reparations, setReparations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stockProducts, setStockProducts] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [caisses, setCaisses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Filtres
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('TOUS');

  // Formulaire Nouvelle Réception (Section 1)
  const [newRepForm, setNewRepForm] = useState({
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
    modePaiement: 'ESPECES',
    reparateur_id: '',
    reparateurNom: '',
    caisse: currentUser?.caisse || 'Caisse Atelier',
    notes: ''
  });

  // Modal Détail / Atelier (Section 2)
  const [selectedRep, setSelectedRep] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState('');
  const [pieceQuantity, setPieceQuantity] = useState(1);
  const [piecePrice, setPiecePrice] = useState('');
  const [customMO, setCustomMO] = useState(0);

  // Modal Validation Sortie Téléphone & Règlement Atelier
  const [exitModalRep, setExitModalRep] = useState(null);
  const [deliverModalRep, setDeliverModalRep] = useState(null);
  const [deliverPayment, setDeliverPayment] = useState({
    montantRegle: '',
    modePaiement: 'ESPECES',
    caisse: currentUser?.caisse || 'Caisse 1 (Magasin)'
  });

  // Modal Retour / Avoir SAV
  const [returnModalRep, setReturnModalRep] = useState(null);
  const [successModalRep, setSuccessModalRep] = useState(null);
  const [labelModalRep, setLabelModalRep] = useState(null);
  const [addPieceModalRep, setAddPieceModalRep] = useState(null);
  const [isTechAccountsModalOpen, setIsTechAccountsModalOpen] = useState(false);
  const [pieceSearchFilter, setPieceSearchFilter] = useState('');
  const [returnForm, setReturnForm] = useState({
    motif: 'Appareil non réparable / retour sous garantie',
    restitutionPieces: true,
    montantRembourse: 0,
    modePaiement: 'ESPECES'
  });

  const showNotification = (msg, type = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [repRes, custRes, prodRes, usersRes, caisseRes] = await Promise.all([
        api.reparation.getAll({ search, statut: statutFilter }),
        api.customer.getAll(),
        api.stock.getAll(),
        api.auth.getUsers(),
        api.caisse.getAll()
      ]);

      if (repRes.success) setReparations(repRes.data || []);
      if (custRes.success) setCustomers(custRes.data || []);
      if (prodRes.success) setStockProducts(prodRes.data || []);
      if (usersRes.success) {
        // Filtrer les techniciens / réparateurs ou tous
        const techs = (usersRes.data || []).filter(u => u.role === 'REPARATEUR' || u.role === 'ADMIN');
        setTechnicians(techs);
      }
      if (caisseRes.success) setCaisses(caisseRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statutFilter]);

  // Handler Création Réception
  const handleCreateReception = async (e) => {
    e.preventDefault();
    if (!newRepForm.clientNom.trim()) {
      showNotification('Veuillez renseigner le nom du client.', 'error');
      return;
    }
    if (!newRepForm.panneDeclaree.trim()) {
      showNotification('Veuillez décrire la panne constatée.', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await api.reparation.create(newRepForm, currentUser);
      if (res.success) {
        showNotification(`Réception enregistrée avec succès : ${res.data.numeroReparation}`);
        setSuccessModalRep(res.data);

        // Réinitialiser formulaire
        setNewRepForm({
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
          modePaiement: 'ESPECES',
          reparateur_id: '',
          reparateurNom: '',
          caisse: currentUser?.caisse || 'Caisse Atelier',
          notes: ''
        });

        loadData();
      } else {
        showNotification(res.error || 'Erreur lors de la réception.', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handler Mise à jour Rapide de Statut (depuis le tableau ou la modale)
  const handleQuickUpdateStatut = async (repId, newStatut) => {
    try {
      const res = await api.reparation.update({
        id: repId,
        updates: { statut: newStatut }
      }, currentUser);

      if (res.success) {
        showNotification(`Statut mis à jour : ${newStatut.replace('_', ' ')}`);
        loadData();
      } else {
        showNotification(res.error || 'Erreur mise à jour statut.', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // Handler Ajout de Pièce depuis Stock (DÉSTOCKAGE AUTOMATIQUE)
  const handleAddPiece = async (e, targetRep = null) => {
    e.preventDefault();
    const rep = targetRep || addPieceModalRep || selectedRep;
    if (!rep || !selectedProductToAdd) {
      showNotification('Veuillez sélectionner une pièce dans le stock.', 'error');
      return;
    }

    const prod = stockProducts.find(p => String(p._id) === String(selectedProductToAdd) || String(p.id) === String(selectedProductToAdd));
    if (!prod) return;

    try {
      const res = await api.reparation.addPiece({
        reparationId: rep.id,
        productId: prod._id || prod.id,
        quantite: Number(pieceQuantity) || 1,
        prixUnitaire: piecePrice !== '' ? Number(piecePrice) : Number(prod.prixVente || 0)
      }, currentUser);

      if (res.success) {
        showNotification(res.message || 'Pièce consommée et retirée du stock !');
        if (selectedRep && selectedRep.id === rep.id) {
          setSelectedRep(res.data);
        }
        setAddPieceModalRep(null);
        setSelectedProductToAdd('');
        setPieceQuantity(1);
        setPiecePrice('');
        loadData();
      } else {
        showNotification(res.error || 'Erreur ajout pièce.', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // Handler Retrait de Pièce (RESTITUTION EN STOCK)
  const handleRemovePiece = async (pieceId) => {
    if (!selectedRep) return;
    try {
      const res = await api.reparation.removePiece({
        pieceId,
        reparationId: selectedRep.id
      }, currentUser);

      if (res.success) {
        showNotification('Pièce retirée et réintégrée dans le stock.');
        setSelectedRep(res.data);
        loadData();
      } else {
        showNotification(res.error || 'Erreur suppression pièce.', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // Handler Mise à jour Statut & Main d'œuvre
  const handleUpdateReparation = async (statut, newMO = null, notes = null, techId = null, techNom = null) => {
    if (!selectedRep) return;
    try {
      const updates = { statut };
      if (newMO !== null) updates.coutMainOeuvre = Number(newMO);
      if (notes !== null) updates.notes = notes;
      if (techId !== null) updates.reparateur_id = techId;
      if (techNom !== null) updates.reparateurNom = techNom;

      const res = await api.reparation.update({
        id: selectedRep.id,
        updates
      }, currentUser);

      if (res.success) {
        showNotification(`Réparation passée au statut : ${statut}`);
        setSelectedRep(res.data);
        loadData();
      } else {
        showNotification(res.error || 'Erreur mise à jour.', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // Handler Sortie / Livraison avec Encaissement
  const handleDeliver = async (e) => {
    e.preventDefault();
    if (!deliverModalRep) return;

    try {
      const res = await api.reparation.deliver({
        id: deliverModalRep.id,
        montantRegle: deliverPayment.montantRegle,
        modePaiement: deliverPayment.modePaiement,
        caisse: deliverPayment.caisse
      }, currentUser);

      if (res.success) {
        showNotification(res.message || 'Produit livré avec succès.');
        handlePrintDelivery(res.data, false);
        setDeliverModalRep(null);
        loadData();
      } else {
        showNotification(res.error || 'Erreur lors de la livraison.', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // Handler Bon de Retour SAV
  const handleExecuteReturn = async (e) => {
    e.preventDefault();
    if (!returnModalRep) return;

    try {
      const res = await api.reparation.createReturn({
        id: returnModalRep.id,
        motif: returnForm.motif,
        restitutionPieces: returnForm.restitutionPieces,
        montantRembourse: returnForm.montantRembourse,
        modePaiement: returnForm.modePaiement,
        caisse: currentUser?.caisse || 'Caisse 1 (Magasin)'
      }, currentUser);

      if (res.success) {
        showNotification(res.message || 'Bon de retour SAV enregistré.');
        handlePrintDelivery(res.data, true);
        setReturnModalRep(null);
        loadData();
      } else {
        showNotification(res.error || 'Erreur bon de retour.', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // Impressions
  const handlePrintLabel = (rep) => {
    if (!rep) return;
    setLabelModalRep(rep);
  };

  const handlePrintReceipt = async (rep) => {
    const settings = getPrinterSettings();
    const html = generateRepairReceiptHtml(rep, settings);
    await printHtmlContent(html, { silent: true, previewIfFailed: true });
  };

  const handlePrintDelivery = async (rep, isReturn = false) => {
    const settings = getPrinterSettings();
    const html = generateRepairDeliveryHtml(rep, isReturn, settings);
    await printHtmlContent(html, { silent: true, previewIfFailed: true });
  };

  // Statistiques rapides
  const stats = {
    total: reparations.length,
    enAttente: reparations.filter(r => r.statut === 'RECEPTIONNE' || r.statut === 'DIAGNOSTIC').length,
    enAtelier: reparations.filter(r => r.statut === 'ATTENTE_PIECE' || r.statut === 'EN_REPARATION').length,
    prets: reparations.filter(r => r.statut === 'REPARE').length,
    livres: reparations.filter(r => r.statut === 'LIVRE').length
  };

  // Si le mode configuré est Dinateck Pro, rendre le composant DinateckRepairView
  if (workflowMode === 'dinateck') {
    return (
      <DinateckRepairView
        reparations={reparations}
        customers={customers}
        stockProducts={stockProducts}
        technicians={technicians}
        caisses={caisses}
        currentUser={currentUser}
        loadData={loadData}
        showNotification={showNotification}
        onToggleMode={() => handleToggleMode('standard')}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-50 select-none overflow-hidden">
      {/* Top Banner Navigation: 3 Sections SAV */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-amber-600" />
            <span>Service Après-Vente (SAV) & Atelier de Réparation</span>
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Réception, pièces déduites du stock, diagnostic technicien et bons de livraison / retours
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Comptes & Règlements Techniciens */}
          <button
            type="button"
            onClick={() => setIsTechAccountsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 shadow-xs transition cursor-pointer"
            title="Consulter les comptes des techniciens, leurs gains et enregistrer un règlement"
          >
            <Wallet className="w-4 h-4 text-emerald-600" />
            <span>Comptes Techniciens</span>
          </button>

          {/* Switch to Dinateck Pro */}
          <button
            type="button"
            onClick={() => handleToggleMode('dinateck')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition cursor-pointer border border-amber-700"
            style={{ backgroundColor: '#d97706', color: '#ffffff' }}
            title="Basculer vers le mode Dinateck Pro (stepper 5 étapes, fiches atelier, onglets détaillés)"
          >
            <Layers className="w-3.5 h-3.5 text-white" />
            <span className="text-white font-black">Mode Dinateck Pro</span>
          </button>

          {/* The 3 Core Sections demanded by user */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveSection('reception')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeSection === 'reception'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>1. Réception de Produit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('atelier')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer relative ${
              activeSection === 'atelier'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/25'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>2. Objets en Atelier ({stats.enAtelier + stats.enAttente})</span>
            {stats.enAtelier > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-2 right-2 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('livraison')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeSection === 'livraison'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>3. Sortie & Livraison ({stats.prets})</span>
          </button>
        </div>
      </div>
    </div>

      {feedback && (
        <div className={`mx-6 mt-3 p-3 rounded-2xl text-xs font-bold flex items-center justify-between shrink-0 ${
          feedback.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          <span>{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* SECTION 1 : RECEPTION DE PRODUIT POUR REPARER */}
      {activeSection === 'reception' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-600" />
                <span>Formulaire de Réception & Prise en Charge Matériel</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Génère instantanément l'étiquette avec code-barres et le bon de prise en charge client
              </p>
            </div>

            <form 
              onSubmit={handleCreateReception} 
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  e.target &&
                  e.target.tagName === 'INPUT' &&
                  !['submit', 'button'].includes(e.target.type) &&
                  e.target.getAttribute('data-allow-enter') !== 'true'
                ) {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const elements = Array.from(form.elements).filter(
                    (el) => !el.disabled && el.tabIndex !== -1 && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && el.type !== 'hidden'
                  );
                  const idx = elements.indexOf(e.target);
                  if (idx > -1 && idx + 1 < elements.length) {
                    const nextEl = elements[idx + 1];
                    if (nextEl && typeof nextEl.focus === 'function') {
                      nextEl.focus();
                      if (typeof nextEl.select === 'function') nextEl.select();
                    }
                  }
                }
              }}
              className="space-y-6"
            >
              {/* Informations Client */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-700 mb-3 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>1. Coordonnées du Client</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nom du client *</label>
                    <input
                      type="text"
                      required
                      list="rep-cust-suggestions"
                      value={newRepForm.clientNom}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = customers.find(c => c.nom.toLowerCase() === val.toLowerCase());
                        if (match) {
                          setNewRepForm({
                            ...newRepForm,
                            clientNom: match.nom,
                            clientTelephone: match.telephone || '',
                            client_id: match._id || match.id
                          });
                        } else {
                          setNewRepForm({ ...newRepForm, clientNom: val, client_id: '' });
                        }
                      }}
                      placeholder="Ex: Mohamed Benali"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-blue-500"
                    />
                    <datalist id="rep-cust-suggestions">
                      {customers.map(c => <option key={c._id} value={c.nom} />)}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone de contact</label>
                    <input
                      type="text"
                      value={newRepForm.clientTelephone}
                      onChange={(e) => setNewRepForm({ ...newRepForm, clientTelephone: e.target.value })}
                      placeholder="Ex: 0550 12 34 56"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Caisse d'encaissement</label>
                    <select
                      value={newRepForm.caisse}
                      onChange={(e) => setNewRepForm({ ...newRepForm, caisse: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-blue-500"
                    >
                      {caisses.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Détails Appareil */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-700 mb-3 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>2. Description du Produit à Réparer</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Type d'Appareil</label>
                    <select
                      value={newRepForm.appareilType}
                      onChange={(e) => setNewRepForm({ ...newRepForm, appareilType: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500"
                    >
                      <option value="Smartphone">Smartphone</option>
                      <option value="PC Portable">PC Portable / Laptop</option>
                      <option value="Tablette">Tablette</option>
                      <option value="Unité Centrale">PC Bureau / Unité</option>
                      <option value="Imprimante">Imprimante</option>
                      <option value="TV / Écran">TV / Moniteur</option>
                      <option value="Autre">Autre équipement</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Marque</label>
                    <input
                      type="text"
                      required
                      value={newRepForm.marque}
                      onChange={(e) => setNewRepForm({ ...newRepForm, marque: e.target.value })}
                      placeholder="Ex: Samsung, Apple, Dell"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Modèle précis</label>
                    <input
                      type="text"
                      required
                      value={newRepForm.modele}
                      onChange={(e) => setNewRepForm({ ...newRepForm, modele: e.target.value })}
                      placeholder="Ex: Galaxy S21 / Inspiron 15"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">N° Série / IMEI</label>
                    <input
                      type="text"
                      value={newRepForm.numeroSerie}
                      onChange={(e) => setNewRepForm({ ...newRepForm, numeroSerie: e.target.value })}
                      placeholder="Optionnel"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Code PIN / Mot de passe déverrouillage</label>
                    <input
                      type="text"
                      value={newRepForm.motDePasseAppareil}
                      onChange={(e) => setNewRepForm({ ...newRepForm, motDePasseAppareil: e.target.value })}
                      placeholder="Schéma ou PIN pour tests atelier"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Accessoires remis</label>
                    <input
                      type="text"
                      value={newRepForm.accessoires}
                      onChange={(e) => setNewRepForm({ ...newRepForm, accessoires: e.target.value })}
                      placeholder="Ex: Chargeur, pochette, sans câble"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Panne & Estimation */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-700 mb-3 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>3. Panne Constatée & Estimation Devis</span>
                </h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Description de la Panne *</label>
                    <textarea
                      required
                      rows={2}
                      value={newRepForm.panneDeclaree}
                      onChange={(e) => setNewRepForm({ ...newRepForm, panneDeclaree: e.target.value })}
                      placeholder="Ex: Écran cassé ne s'allume plus, connecteur de charge endommagé..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-rose-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Estimation Devis (DA)</label>
                      <input
                        type="number"
                        min="0"
                        value={newRepForm.estimationDevis}
                        onChange={(e) => setNewRepForm({ ...newRepForm, estimationDevis: e.target.value })}
                        placeholder="Ex: 8500"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:bg-white focus:outline-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Acompte Versé (DA)</label>
                      <input
                        type="number"
                        min="0"
                        value={newRepForm.acomptePaye}
                        onChange={(e) => setNewRepForm({ ...newRepForm, acomptePaye: e.target.value })}
                        placeholder="Ex: 2000"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-emerald-700 focus:bg-white focus:outline-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Mode Paiement Acompte</label>
                      <select
                        value={newRepForm.modePaiement}
                        onChange={(e) => setNewRepForm({ ...newRepForm, modePaiement: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-rose-500"
                      >
                        <option value="ESPECES">Espèces</option>
                        <option value="CARTE">Carte / TPE</option>
                        <option value="VIREMENT">Virement / CCP</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Assigner Réparateur</label>
                      <select
                        value={newRepForm.reparateur_id}
                        onChange={(e) => {
                          const tech = technicians.find(t => String(t.id) === e.target.value);
                          setNewRepForm({
                            ...newRepForm,
                            reparateur_id: e.target.value,
                            reparateurNom: tech ? tech.nom : ''
                          });
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-rose-500"
                      >
                        <option value="">-- En attente d'attribution --</option>
                        {technicians.map(t => (
                          <option key={t.id} value={t.id}>{t.nom} ({t.username})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bouton de validation */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-sm rounded-2xl shadow-lg border-2 border-blue-700 flex items-center gap-2.5 transition cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                >
                  <Tag className="w-5 h-5 text-white" />
                  <span className="text-white font-black tracking-wide text-sm">
                    {loading ? 'Enregistrement en cours...' : 'Enregistrer Réception & Imprimer Étiquette + Bon'}
                  </span>
                  <ArrowRight className="w-5 h-5 text-white" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECTION 2 : OBJETS EN ATELIER POUR REPARER (AVEC PIECES RETIREES DU STOCK) */}
      {activeSection === 'atelier' && (
        <div className="flex-1 flex flex-col min-h-0 p-6 space-y-4 overflow-hidden">
          {/* Barre de filtres et recherche */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par N° réparation, client, marque, modèle, panne..."
                className="w-full text-xs font-bold text-slate-800 bg-transparent focus:outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statutFilter}
                onChange={(e) => setStatutFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-amber-500"
              >
                <option value="TOUS">Tous les statuts</option>
                <option value="RECEPTIONNE">Réceptionné</option>
                <option value="DIAGNOSTIC">Diagnostic en cours</option>
                <option value="ATTENTE_PIECE">En attente pièce</option>
                <option value="EN_REPARATION">En cours de réparation</option>
                <option value="REPARE">Réparé (Prêt)</option>
                <option value="IRREPARABLE">Irréparable</option>
                <option value="LIVRE">Livré au client</option>
                <option value="RETOUR_GARANTIE">Retour SAV</option>
              </select>

              <button
                type="button"
                onClick={loadData}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Actualiser l'atelier"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tableau des appareils en atelier */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px] sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4">N° Réparation</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Appareil</th>
                  <th className="py-3 px-4">Panne Déclarée</th>
                  <th className="py-3 px-4">Technicien</th>
                  <th className="py-3 px-4 text-center">Pièces Consommées</th>
                  <th className="py-3 px-4 text-right">Total TTC</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reparations.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400 font-medium">
                      Aucun appareil trouvé dans cette section.
                    </td>
                  </tr>
                ) : (
                  reparations.map((rep) => {
                    const statutColors = {
                      RECEPTIONNE: 'bg-blue-50 text-blue-700 border-blue-200',
                      DIAGNOSTIC: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                      ATTENTE_PIECE: 'bg-purple-50 text-purple-700 border-purple-200',
                      EN_REPARATION: 'bg-amber-50 text-amber-700 border-amber-200',
                      REPARE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                      IRREPARABLE: 'bg-rose-50 text-rose-700 border-rose-200',
                      LIVRE: 'bg-slate-100 text-slate-700 border-slate-300',
                      RETOUR_GARANTIE: 'bg-orange-100 text-orange-800 border-orange-300'
                    };

                    const piecesCount = rep.pieces?.length || 0;

                    return (
                      <tr key={rep.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono font-black text-slate-800">
                          {rep.numeroReparation}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          <div>{rep.clientNom}</div>
                          <span className="text-[10px] text-slate-400 font-medium">{rep.clientTelephone || 'Sans tel'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">{rep.marque} {rep.modele}</div>
                          <span className="text-[10px] text-slate-500 font-medium">{rep.appareilType}</span>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-600 font-medium" title={rep.panneDeclaree}>
                          {rep.panneDeclaree}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-700">
                          {rep.reparateurNom ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 font-semibold">
                              <Wrench className="w-3 h-3 text-amber-500" />
                              {rep.reparateurNom}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">Non assigné</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {piecesCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                              {piecesCount} pièce{piecesCount > 1 ? 's' : ''} (Stock déduit)
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-800">
                          {(rep.totalTTC || 0).toLocaleString('fr-DZ')} DA
                        </td>
                        <td className="py-3 px-4 text-center">
                          <select
                            value={rep.statut}
                            onChange={(e) => handleQuickUpdateStatut(rep.id, e.target.value)}
                            className={`px-2 py-1 rounded-lg text-xs font-black uppercase tracking-wider border cursor-pointer outline-hidden transition shadow-xs ${
                              statutColors[rep.statut] || 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                            title="Modifier l'état de la réparation directement"
                          >
                            <option value="RECU">REÇU</option>
                            <option value="DIAGNOSTIC">DIAGNOSTIC</option>
                            <option value="EN_COURS">EN COURS</option>
                            <option value="EN_ATTENTE_PIECE">EN ATTENTE PIÈCE</option>
                            <option value="REPARE">RÉPARÉ (PRÊT)</option>
                            <option value="IRREPARABLE">IRRÉPARABLE</option>
                            <option value="LIVRE">LIVRÉ</option>
                            <option value="RETOUR_GARANTIE">RETOUR GARANTIE</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          {/* Ajouter un produit / pièce depuis le stock */}
                          <button
                            type="button"
                            onClick={() => {
                              setAddPieceModalRep(rep);
                              setSelectedProductToAdd('');
                              setPieceQuantity(1);
                              setPiecePrice('');
                              setPieceSearchFilter('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                            title="Ajouter un produit / pièce depuis le stock dans cette réparation"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Pièce Stock</span>
                          </button>

                          {/* Ouvrir l'atelier pour gérer les pièces & statut */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRep(rep);
                              setCustomMO(rep.coutMainOeuvre || 0);
                              setIsDetailModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-bold border border-amber-200 transition cursor-pointer"
                            title="Ouvrir l'Atelier (Diagnostic & Pièces)"
                          >
                            Atelier
                          </button>

                          {/* Imprimer Étiquette */}
                          <button
                            type="button"
                            onClick={() => handlePrintLabel(rep)}
                            className="p-1 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Réimprimer étiquette produit"
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>

                          {/* Imprimer Bon Prise en Charge */}
                          <button
                            type="button"
                            onClick={() => handlePrintReceipt(rep)}
                            className="p-1 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Imprimer bon de prise en charge"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 3 : LIVRAISON & SORTIE DES PRODUITS REPARES (ET BONS DE RETOUR) */}
      {activeSection === 'livraison' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800">Appareils Prêts pour Livraison ou Déjà Livrés</h3>
              <p className="text-xs text-slate-500 font-medium">
                Validation du règlement final, encaissement en caisse, bons de livraison et retours SAV (-1)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 font-black text-xs rounded-xl">
                {stats.prets} Prêt(s) à la remise
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reparations.filter(r => r.statut === 'REPARE' || r.statut === 'LIVRE' || r.statut === 'IRREPARABLE' || r.statut === 'RETOUR_GARANTIE').map((rep) => {
              const isPret = rep.statut === 'REPARE';
              const isLivre = rep.statut === 'LIVRE';
              const isRetour = rep.statut === 'RETOUR_GARANTIE';
              const reste = Number(rep.montantReste || 0);

              return (
                <div key={rep.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-sm text-slate-800">{rep.numeroReparation}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        isPret ? 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse' :
                        isLivre ? 'bg-slate-100 text-slate-700 border-slate-300' :
                        isRetour ? 'bg-orange-100 text-orange-800 border-orange-300' :
                        'bg-rose-100 text-rose-800 border-rose-300'
                      }`}>
                        {rep.statut}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-black text-base text-slate-900">{rep.appareilType} {rep.marque} {rep.modele}</h4>
                      <div className="text-xs text-slate-600 font-bold mt-0.5">
                        Client : <span className="text-slate-800">{rep.clientNom}</span> {rep.clientTelephone ? `(${rep.clientTelephone})` : ''}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1 border border-slate-100">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Pièces consommées :</span>
                        <span className="font-bold text-slate-700">{(rep.coutPieces || 0).toLocaleString('fr-DZ')} DA</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Main d'œuvre :</span>
                        <span className="font-bold text-slate-700">{(rep.coutMainOeuvre || 0).toLocaleString('fr-DZ')} DA</span>
                      </div>
                      <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200">
                        <span>Total Réparation :</span>
                        <span>{(rep.totalTTC || 0).toLocaleString('fr-DZ')} DA</span>
                      </div>
                      <div className="flex justify-between text-emerald-600">
                        <span>Acompte versé :</span>
                        <span className="font-bold">-{(rep.acomptePaye || 0).toLocaleString('fr-DZ')} DA</span>
                      </div>
                      <div className="flex justify-between text-rose-600 font-black">
                        <span>Reste à payer :</span>
                        <span>{reste.toLocaleString('fr-DZ')} DA</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions de livraison & bon de retour */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    {isPret && (
                      <button
                        type="button"
                        onClick={() => {
                          setExitModalRep(rep);
                        }}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Livrer & Encaisser ({reste} DA)</span>
                      </button>
                    )}

                    {isLivre && (
                      <div className="w-full flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePrintDelivery(rep, false)}
                          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Bon de Livraison</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReturnModalRep(rep);
                            setReturnForm({
                              motif: 'Retour client sous garantie',
                              restitutionPieces: true,
                              montantRembourse: rep.montantPaye || 0,
                              modePaiement: 'ESPECES'
                            });
                          }}
                          className="py-2 px-3 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                          title="Faire un bon de livraison retour (-1)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retour (-1)</span>
                        </button>
                      </div>
                    )}

                    {isRetour && (
                      <button
                        type="button"
                        onClick={() => handlePrintDelivery(rep, true)}
                        className="w-full py-2 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimer Bon de Retour (Avoir)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL ATELIER (AJOUT DE PIECES RETIREES DU STOCK & STATUT) */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={selectedRep ? `Atelier de Réparation : ${selectedRep.numeroReparation} (${selectedRep.marque} ${selectedRep.modele})` : 'Atelier'}
        maxWidth="max-w-3xl"
      >
        {selectedRep && (
          <div className="space-y-6">
            {/* Statut & Assignation */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Client :</span>
                  <div className="font-black text-slate-900 text-sm">{selectedRep.clientNom} ({selectedRep.clientTelephone || 'Sans tel'})</div>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Appareil :</span>
                  <div className="font-black text-slate-900 text-sm">{selectedRep.appareilType} {selectedRep.marque} {selectedRep.modele}</div>
                </div>
                {selectedRep.motDePasseAppareil && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase">PIN / Déverrouillage :</span>
                    <div className="font-mono font-black text-blue-700 text-sm">{selectedRep.motDePasseAppareil}</div>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Changer Statut :</span>
                  <select
                    value={selectedRep.statut}
                    onChange={(e) => handleUpdateReparation(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-800 focus:outline-amber-500"
                  >
                    <option value="RECEPTIONNE">Réceptionné</option>
                    <option value="DIAGNOSTIC">Diagnostic en cours</option>
                    <option value="ATTENTE_PIECE">En attente pièce détachée</option>
                    <option value="EN_REPARATION">En cours de réparation</option>
                    <option value="REPARE">Réparé (Prêt pour livraison)</option>
                    <option value="IRREPARABLE">Irréparable</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Technicien :</span>
                  <select
                    value={selectedRep.reparateur_id || ''}
                    onChange={(e) => {
                      const tech = technicians.find(t => String(t.id) === e.target.value);
                      handleUpdateReparation(selectedRep.statut, null, null, tech ? tech.id : null, tech ? tech.nom : '');
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-800 focus:outline-amber-500"
                  >
                    <option value="">Non assigné</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>{t.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Consommation de Pièces Détachées (Déstockage automatique) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>Pièces Détachées du Stock (Déstockage automatique)</span>
                </h4>
                <span className="text-[11px] text-emerald-600 font-bold">
                  ✓ Toute pièce ajoutée est immédiatement retirée du stock
                </span>
              </div>

              <form onSubmit={handleAddPiece} className="flex flex-wrap items-center gap-2 bg-blue-50/50 p-3 rounded-2xl border border-blue-200">
                <div className="flex-1 min-w-[240px]">
                  <PieceSearchAutocomplete
                    products={stockProducts}
                    selectedProductId={selectedProductToAdd}
                    onSelectProduct={(prod) => {
                      if (prod) {
                        setSelectedProductToAdd(String(prod._id || prod.id));
                        setPiecePrice(String(prod.prixVente || 0));
                      } else {
                        setSelectedProductToAdd('');
                        setPiecePrice('');
                      }
                    }}
                    placeholder="Taper nom pièce, réf ou scanner code-barre..."
                  />
                </div>

                <div className="w-20">
                  <input
                    type="number"
                    min="1"
                    value={pieceQuantity}
                    onChange={(e) => setPieceQuantity(e.target.value)}
                    placeholder="Qté"
                    className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center focus:outline-blue-500"
                  />
                </div>

                <div className="w-28">
                  <input
                    type="number"
                    min="0"
                    value={piecePrice}
                    onChange={(e) => setPiecePrice(e.target.value)}
                    placeholder="Prix client"
                    className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-right focus:outline-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!selectedProductToAdd}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Consommer</span>
                </button>
              </form>

              {/* Tableau des pièces ajoutées */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Désignation</th>
                      <th className="py-2 px-3 text-center">Qté</th>
                      <th className="py-2 px-3 text-right">Prix Facturé</th>
                      <th className="py-2 px-3 text-right">Total Ligne</th>
                      <th className="py-2 px-3 text-center">Stock</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(!selectedRep.pieces || selectedRep.pieces.length === 0) ? (
                      <tr>
                        <td colSpan="6" className="py-4 text-center text-slate-400 italic">
                          Aucune pièce ajoutée. Vous pouvez facturer uniquement la main d'œuvre.
                        </td>
                      </tr>
                    ) : (
                      selectedRep.pieces.map(p => (
                        <tr key={p.id}>
                          <td className="py-2 px-3 font-bold text-slate-800">{p.nom}</td>
                          <td className="py-2 px-3 text-center font-bold">{p.quantite}</td>
                          <td className="py-2 px-3 text-right">{(p.prixUnitaire || 0).toLocaleString('fr-DZ')} DA</td>
                          <td className="py-2 px-3 text-right font-black">{(p.totalLigne || 0).toLocaleString('fr-DZ')} DA</td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Déduit
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemovePiece(p.id)}
                              className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                              title="Restituer la pièce au stock"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Coût Main d'œuvre & Récapitulatif Total */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-black text-slate-700">Main d'œuvre & Service (DA) :</label>
                <input
                  type="number"
                  min="0"
                  value={customMO}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomMO(val);
                    handleUpdateReparation(selectedRep.statut, val);
                  }}
                  className="w-28 px-3 py-1 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-800 text-right focus:outline-blue-500"
                />
              </div>

              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-500 block">Total Final (Pièces + MO)</span>
                <span className="text-xl font-black text-slate-900">
                  {(selectedRep.totalTTC || 0).toLocaleString('fr-DZ')} DA
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Fermer
              </button>

              <button
                type="button"
                onClick={() => {
                  const repToDeliver = selectedRep;
                  setIsDetailModalOpen(false);
                  setExitModalRep(repToDeliver);
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Valider la Sortie du Téléphone</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL VALIDATION DE SORTIE DU TÉLÉPHONE & RÈGLEMENT */}
      <RepairExitModal
        isOpen={!!exitModalRep}
        onClose={() => setExitModalRep(null)}
        reparation={exitModalRep}
        caisses={caisses}
        currentUser={currentUser}
        onSuccess={(updatedRep) => {
          showNotification('Sortie du téléphone validée et enregistrée avec succès !');
          loadData();
          if (selectedRep && selectedRep.id === updatedRep.id) {
            setSelectedRep(updatedRep);
          }
        }}
      />

      {/* MODAL BON DE RETOUR SAV (-1) */}
      <Modal
        isOpen={!!returnModalRep}
        onClose={() => setReturnModalRep(null)}
        title={returnModalRep ? `Bon de Retour SAV (-1) : ${returnModalRep.numeroReparation}` : 'Retour SAV'}
        maxWidth="max-w-md"
      >
        {returnModalRep && (
          <form onSubmit={handleExecuteReturn} className="space-y-4">
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-2xl text-xs text-orange-900 space-y-1">
              <div className="font-bold">Appareil retourné : {returnModalRep.appareilType} {returnModalRep.marque} {returnModalRep.modele}</div>
              <div>Client : {returnModalRep.clientNom}</div>
              <div className="text-[11px] text-orange-700">Ce bon enregistre un retour en quantité négative (-1) et édite un bon d'avoir / retour.</div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Motif du retour</label>
              <input
                type="text"
                required
                value={returnForm.motif}
                onChange={(e) => setReturnForm({ ...returnForm, motif: e.target.value })}
                placeholder="Ex: Défaut persistant sous garantie"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ret-pieces"
                checked={returnForm.restitutionPieces}
                onChange={(e) => setReturnForm({ ...returnForm, restitutionPieces: e.target.checked })}
                className="w-4 h-4 text-orange-600 rounded"
              />
              <label htmlFor="ret-pieces" className="text-xs font-bold text-slate-700 cursor-pointer">
                Réintégrer automatiquement les pièces détachées au stock (+1)
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Montant à rembourser (DA)</label>
              <input
                type="number"
                min="0"
                value={returnForm.montantRembourse}
                onChange={(e) => setReturnForm({ ...returnForm, montantRembourse: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-rose-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReturnModalRep(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-black rounded-xl shadow-md transition"
              >
                Valider Bon de Retour (-1)
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL AJOUT PIÈCE DEPUIS STOCK (DÉSTOCKAGE AUTOMATIQUE) */}
      <Modal
        isOpen={!!addPieceModalRep}
        onClose={() => {
          setAddPieceModalRep(null);
          setSelectedProductToAdd('');
          setPieceQuantity(1);
          setPiecePrice('');
          setPieceSearchFilter('');
        }}
        title="Ajouter une Pièce depuis le Stock"
        maxWidth="max-w-xl"
      >
        {addPieceModalRep && (
          <form onSubmit={(e) => handleAddPiece(e, addPieceModalRep)} className="space-y-4">
            {/* Header info réparation */}
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Dossier Réparation</span>
                <div className="font-mono font-black text-sm text-blue-950">{addPieceModalRep.numeroReparation}</div>
                <div className="text-xs font-bold text-blue-800">
                  {addPieceModalRep.appareilType} {addPieceModalRep.marque} {addPieceModalRep.modele}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-blue-600">Client</span>
                <div className="text-xs font-black text-blue-900">{addPieceModalRep.clientNom}</div>
                <div className="text-[10px] text-blue-700">{addPieceModalRep.clientTelephone || 'Sans tél'}</div>
              </div>
            </div>

            {/* Recherche de produit dans le stock */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-blue-600" />
                <span>Rechercher une pièce ou article dans le stock</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tapez le nom, la référence ou le code-barres..."
                  value={pieceSearchFilter}
                  onChange={(e) => setPieceSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition outline-hidden"
                  autoFocus
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>

              {/* Liste de sélection de produit */}
              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
                {stockProducts
                  .filter((p) => {
                    if (!pieceSearchFilter.trim()) return true;
                    const q = pieceSearchFilter.toLowerCase();
                    return (
                      (p.nom && p.nom.toLowerCase().includes(q)) ||
                      (p.reference && p.reference.toLowerCase().includes(q)) ||
                      (p.codeBarres && p.codeBarres.toLowerCase().includes(q)) ||
                      (p.categorie && p.categorie.toLowerCase().includes(q))
                    );
                  })
                  .slice(0, 8)
                  .map((p) => {
                    const isSelected = String(selectedProductToAdd) === String(p._id || p.id);
                    const stockDispo = p.quantite ?? p.stockActuel ?? 0;
                    return (
                      <div
                        key={p._id || p.id}
                        onClick={() => {
                          setSelectedProductToAdd(p._id || p.id);
                          setPiecePrice(p.prixVente || '');
                        }}
                        className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition ${
                          isSelected
                            ? 'bg-blue-50 border-l-4 border-l-blue-600'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="font-bold text-slate-900 truncate">{p.nom}</div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            {p.reference && <span>Réf: {p.reference}</span>}
                            {p.categorie && <span>• {p.categorie}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            stockDispo <= 0 ? 'bg-rose-100 text-rose-700' :
                            stockDispo < 5 ? 'bg-amber-100 text-amber-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            Stock: {stockDispo}
                          </span>
                          <span className="font-black text-blue-700">
                            {(p.prixVente || 0).toLocaleString('fr-DZ')} DA
                          </span>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                              ✓
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Quantité & Prix unitaire */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantité à consommer</label>
                <input
                  type="number"
                  min="1"
                  value={pieceQuantity}
                  onChange={(e) => setPieceQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:border-blue-500 transition outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prix Unitaire Vente (DA)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={piecePrice}
                  onChange={(e) => setPiecePrice(e.target.value)}
                  placeholder="Prix unitaire"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-blue-700 focus:bg-white focus:border-blue-500 transition outline-hidden"
                  required
                />
              </div>
            </div>

            {/* Total et alerte déstockage */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
              <div className="flex justify-between items-center font-black">
                <span className="text-amber-900">Total Pièce facturé :</span>
                <span className="text-sm text-blue-700">
                  {(Number(pieceQuantity || 1) * Number(piecePrice || 0)).toLocaleString('fr-DZ')} DA
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-tight">
                ⚡ <strong>Déstockage automatique :</strong> Cette quantité sera immédiatement déduite du stock réel du magasin (mouvement SORTIE_REPARATION) et le coût de la réparation sera recalculé.
              </p>
            </div>

            {/* Boutons actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAddPieceModalRep(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!selectedProductToAdd}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter et Déduire du Stock</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL SUCCÈS RÉCEPTION & IMPRESSIONS DIRECTES */}
      <Modal
        isOpen={!!successModalRep}
        onClose={() => {
          setSuccessModalRep(null);
          setActiveSection('atelier');
        }}
        title="Appareil Réceptionné avec Succès !"
        maxWidth="max-w-md"
      >
        {successModalRep && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1">
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl mx-auto flex items-center justify-center font-black text-xl shadow-md shadow-emerald-500/30">
                ✓
              </div>
              <div className="text-base font-black text-emerald-950 mt-2">Dossier N° {successModalRep.numeroReparation}</div>
              <div className="text-xs font-bold text-emerald-800">
                {successModalRep.appareilType} {successModalRep.marque} {successModalRep.modele}
              </div>
              <div className="text-xs text-emerald-700">Client : {successModalRep.clientNom} ({successModalRep.clientTelephone || 'Sans tél'})</div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handlePrintLabel(successModalRep)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <Tag className="w-4 h-4" />
                <span>1. Imprimer l'Étiquette Code-Barre (Appareil)</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrintReceipt(successModalRep)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>2. Imprimer le Bon de Prise en Charge (Client)</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setSuccessModalRep(null);
                  setActiveSection('reception');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                + Nouvelle Réception
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedRep(successModalRep);
                  setIsDetailModalOpen(true);
                  setSuccessModalRep(null);
                  setActiveSection('atelier');
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <span>Ouvrir dans l'Atelier</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Prévisualisation & Impression Étiquette Thermique SAV */}
      <RepairLabelModal
        isOpen={!!labelModalRep}
        onClose={() => setLabelModalRep(null)}
        reparation={labelModalRep}
      />

      {/* Modal Comptes & Règlements des Techniciens */}
      <TechniciansAccountsModal
        isOpen={isTechAccountsModalOpen}
        onClose={() => setIsTechAccountsModalOpen(false)}
        currentUser={currentUser}
        onUpdated={loadData}
      />
    </div>
  );
}
