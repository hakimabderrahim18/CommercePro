import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { 
  Package, 
  Wrench, 
  CheckCircle, 
  Wallet, 
  Printer, 
  AlertCircle, 
  Smartphone, 
  User, 
  DollarSign, 
  CreditCard,
  Building2,
  FileText
} from 'lucide-react';
import { generateRepairDeliveryHtml } from '../../utils/repairPrinterHelper';
import { printHtmlContent, getPrinterSettings } from '../../utils/printerHelper';

export default function RepairExitModal({
  isOpen,
  onClose,
  reparation,
  caisses = [],
  currentUser,
  onSuccess
}) {
  const [technicians, setTechnicians] = useState([]);
  const [loadingTechs, setLoadingTechs] = useState(false);

  // Valeurs financières
  const [customMO, setCustomMO] = useState(0);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [creditTech, setCreditTech] = useState(true);
  const [amountPaid, setAmountPaid] = useState('');
  const [caisse, setCaisse] = useState('');
  const [modePaiement, setModePaiement] = useState('ESPECES');
  const [printReceipt, setPrintReceipt] = useState(true);
  const [printFormat, setPrintFormat] = useState('80mm'); // '80mm' ou 'a4'

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Charger les techniciens et initialiser les champs à l'ouverture
  useEffect(() => {
    if (!isOpen || !reparation) return;

    setErrorMsg('');
    const mo = Number(reparation.coutMainOeuvre || 0);
    setCustomMO(mo);

    setSelectedTechId(
      reparation.reparateur_id ? String(reparation.reparateur_id) : (currentUser?.id ? String(currentUser.id) : '')
    );
    setCreditTech(true);

    // Initialiser la caisse
    if (caisses && caisses.length > 0) {
      const defaultCaisse = caisses.find(c => c.nom === reparation.caisse) || caisses[0];
      setCaisse(defaultCaisse.nom);
    } else {
      setCaisse(reparation.caisse || 'Caisse Atelier');
    }

    setModePaiement(reparation.modePaiement || 'ESPECES');

    // Charger la liste des comptes techniciens pour afficher le solde
    const fetchTechs = async () => {
      try {
        setLoadingTechs(true);
        const res = await api.technician.getAccounts();
        if (res && res.success) {
          setTechnicians(res.data || []);
        }
      } catch (e) {
        console.error('Erreur chargement techniciens:', e);
      } finally {
        setLoadingTechs(false);
      }
    };
    fetchTechs();
  }, [isOpen, reparation, caisses, currentUser]);

  // Pièces consommées
  const pieces = reparation?.pieces || [];
  const coutPieces = pieces.reduce((sum, p) => sum + Number(p.totalLigne || (Number(p.quantite || 1) * Number(p.prixUnitaire || 0))), 0);
  const moNum = Math.max(0, Number(customMO) || 0);
  const totalTTC = Math.round((coutPieces + moNum) * 100) / 100;

  const acompte = Number(reparation?.acomptePaye || 0);
  const dejaPaye = Number(reparation?.montantPaye || 0);
  const netAPayer = Math.max(0, Math.round((totalTTC - acompte - dejaPaye) * 100) / 100);

  // Mettre à jour amountPaid par défaut sur le net à payer lors du changement de MO
  useEffect(() => {
    if (isOpen) {
      setAmountPaid(String(netAPayer));
    }
  }, [netAPayer, isOpen]);

  // Technicien sélectionné
  const selectedTech = technicians.find(t => String(t.id) === String(selectedTechId));
  const techCurrentSolde = Number(selectedTech?.soldeTechnicien || 0);
  const techNewSolde = creditTech ? Math.round((techCurrentSolde + moNum) * 100) / 100 : techCurrentSolde;

  // Calcul du reste dû
  const paidNow = Math.max(0, Number(amountPaid) || 0);
  const remainingDebt = Math.max(0, Math.round((netAPayer - paidNow) * 100) / 100);

  if (!isOpen || !reparation) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const chosenTech = technicians.find(t => String(t.id) === String(selectedTechId));

      const res = await api.reparation.deliver({
        id: reparation.id,
        montantRegle: paidNow,
        modePaiement,
        caisse,
        coutMainOeuvre: moNum,
        reparateur_id: chosenTech ? chosenTech.id : (reparation.reparateur_id || null),
        reparateurNom: chosenTech ? chosenTech.nom : (reparation.reparateurNom || ''),
        crediterTechnicien: creditTech
      });

      if (!res || !res.success) {
        throw new Error(res?.error || 'Erreur lors de la validation de sortie de l’appareil.');
      }

      const updatedRep = res.data;

      // Impression du bon de restitution / livraison si cochée
      if (printReceipt) {
        try {
          const cfg = getPrinterSettings();
          const targetCfg = { ...cfg, format: printFormat };
          const html = generateRepairDeliveryHtml(updatedRep, false, targetCfg);
          await printHtmlContent(html, printFormat === '80mm' ? '80mm' : 'a4');
        } catch (printErr) {
          console.warn('Erreur impression bon de livraison:', printErr);
        }
      }

      if (onSuccess) onSuccess(updatedRep);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Impossible de valider la sortie');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Validation de Sortie Téléphone & Règlement Atelier"
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Fiche Appareil & Client */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-3.5 rounded-2xl text-white flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 border border-blue-400/40 rounded-xl">
              <Smartphone className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-wide">
                  {reparation.appareilType} {reparation.marque} {reparation.modele}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {reparation.numeroReparation}
                </span>
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-3 mt-0.5">
                <span>Client : <strong className="text-white">{reparation.clientNom}</strong></span>
                {reparation.clientTelephone && (
                  <span>Tél : <strong className="text-white">{reparation.clientTelephone}</strong></span>
                )}
                {reparation.numeroSerie && (
                  <span>IMEI/Série : <strong className="text-white">{reparation.numeroSerie}</strong></span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Statut atelier</span>
            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-white shadow-xs">
              Sortie vers Client
            </span>
          </div>
        </div>

        {/* DOUBLE CARTE : 1) LES PIÈCES ONT LEUR PRIX  |  2) LA MAIN D'ŒUVRE A SON PRIX */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* CARTE 1 : PIÈCES DÉTACHÉES (THE PIECE GETS THE PRICE) */}
          <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-blue-200/80 mb-2">
                <div className="flex items-center gap-1.5 text-blue-900 font-black text-xs uppercase tracking-wide">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>1. Pièces Détachées Consommées</span>
                </div>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                  {pieces.length} pièce(s)
                </span>
              </div>

              {pieces.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 italic">
                  Aucune pièce de rechange consommée sur cet appareil.
                </div>
              ) : (
                <div className="max-h-36 overflow-y-auto divide-y divide-blue-100 text-xs">
                  {pieces.map((p, idx) => (
                    <div key={p.id || idx} className="py-1.5 flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-bold text-slate-800 truncate">{p.nom}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {p.quantite} x {Number(p.prixUnitaire || 0).toLocaleString('fr-DZ')} DA
                        </div>
                      </div>
                      <div className="font-black text-blue-900 shrink-0">
                        {Number(p.totalLigne || 0).toLocaleString('fr-DZ')} DA
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-blue-200 flex items-center justify-between text-xs mt-2">
              <span className="font-bold text-slate-600">Total Pièces Détachées :</span>
              <span className="text-base font-black text-blue-800">
                {coutPieces.toLocaleString('fr-DZ')} DA
              </span>
            </div>
          </div>

          {/* CARTE 2 : MAIN D'ŒUVRE & COMPTE TECHNICIEN (LA MAIN D'ŒUVRE GETS THE PRICE) */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/80 mb-2">
                <div className="flex items-center gap-1.5 text-amber-900 font-black text-xs uppercase tracking-wide">
                  <Wrench className="w-4 h-4 text-amber-600" />
                  <span>2. Main d'Œuvre & Compte Technicien</span>
                </div>
              </div>

              {/* Saisie montant Main d'œuvre */}
              <div className="mb-2.5">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Montant Main d'œuvre (Prix du service) :
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={customMO}
                    onChange={(e) => setCustomMO(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-sm font-black text-amber-900 focus:outline-amber-500"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1.5 text-xs font-bold text-slate-400">DA</span>
                </div>
              </div>

              {/* Choix du compte Technicien */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Technicien bénéficiaire (Compte réparateur) :
                </label>
                <select
                  value={selectedTechId}
                  onChange={(e) => setSelectedTechId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-amber-500"
                >
                  <option value="">-- Aucun technicien assigné --</option>
                  {technicians.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nom} ({t.username}) - Solde: {Number(t.soldeTechnicien || 0).toLocaleString('fr-DZ')} DA
                    </option>
                  ))}
                </select>

                {selectedTech && (
                  <div className="mt-1.5 p-2 bg-white/80 rounded-xl border border-amber-200 text-[11px] space-y-0.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Solde actuel du compte :</span>
                      <strong className="text-slate-800">{techCurrentSolde.toLocaleString('fr-DZ')} DA</strong>
                    </div>
                    {creditTech && moNum > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Nouveau solde après sortie :</span>
                        <span>{techNewSolde.toLocaleString('fr-DZ')} DA (+{moNum.toLocaleString('fr-DZ')} DA)</span>
                      </div>
                    )}
                  </div>
                )}

                <label className="mt-2 flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={creditTech}
                    onChange={(e) => setCreditTech(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <span className="text-[11px] font-bold text-slate-700">
                    Créditer automatiquement la main d'œuvre ({moNum.toLocaleString('fr-DZ')} DA) au compte de ce technicien
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-2 border-t border-amber-200 flex items-center justify-between text-xs mt-2">
              <span className="font-bold text-slate-600">Total Main d'Œuvre :</span>
              <span className="text-base font-black text-amber-800">
                {moNum.toLocaleString('fr-DZ')} DA
              </span>
            </div>
          </div>
        </div>

        {/* FENÊTRE DE SAISIE DE SOMME & MODALITÉS DE RÈGLEMENT */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">Total Réparation (Pièces + MO)</span>
              <span className="text-xl font-black text-slate-900">
                {totalTTC.toLocaleString('fr-DZ')} DA
              </span>
            </div>

            {acompte > 0 && (
              <div>
                <span className="text-[11px] font-bold text-emerald-600 block">Acompte déjà versé</span>
                <span className="text-base font-black text-emerald-700">
                  -{acompte.toLocaleString('fr-DZ')} DA
                </span>
              </div>
            )}

            <div className="text-right">
              <span className="text-[11px] font-black uppercase text-slate-700 block">Net restant à solder</span>
              <span className="text-2xl font-black text-emerald-700">
                {netAPayer.toLocaleString('fr-DZ')} DA
              </span>
            </div>
          </div>

          {/* Saisie de la somme perçue maintenant */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-black text-slate-800 mb-1 flex items-center justify-between">
                <span>Somme perçue maintenant (Montant encaissé) :</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAmountPaid(String(netAPayer))}
                    className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[10px] font-black rounded-md transition cursor-pointer"
                  >
                    Tout solder ({netAPayer} DA)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountPaid('0')}
                    className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-black rounded-md transition cursor-pointer"
                  >
                    0 DA (Tout en dette)
                  </button>
                </div>
              </label>

              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border-2 border-emerald-500 rounded-xl text-lg font-black text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="0"
                />
                <span className="absolute right-3.5 top-3 text-xs font-black text-slate-400">DA</span>
              </div>
            </div>

            {/* Statut du solde restant / Dette client */}
            <div className="p-2.5 rounded-xl border text-xs font-bold flex flex-col justify-center h-[50px] bg-white">
              {remainingDebt > 0 ? (
                <div className="text-rose-700">
                  <div className="flex justify-between">
                    <span>Reste dû :</span>
                    <strong className="font-black text-sm">{remainingDebt.toLocaleString('fr-DZ')} DA</strong>
                  </div>
                  <div className="text-[10px] text-rose-500 font-semibold truncate">
                    → Imputé en dette sur le compte client
                  </div>
                </div>
              ) : (
                <div className="text-emerald-700 flex items-center gap-1.5 font-black text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Réparation entièrement soldée</span>
                </div>
              )}
            </div>
          </div>

          {/* Choix des Comptes : Compte Caisse & Mode de règlement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Compte Caisse réceptrice :</span>
              </label>
              <select
                value={caisse}
                onChange={(e) => setCaisse(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-blue-500"
              >
                {caisses.map(c => (
                  <option key={c.id || c.nom} value={c.nom}>{c.nom}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mode de Paiement :</span>
              </label>
              <select
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-emerald-500"
              >
                <option value="ESPECES">Espèces</option>
                <option value="CARTE">Carte / TPE</option>
                <option value="VIREMENT">Virement / CCP</option>
                <option value="CHEQUE">Chèque</option>
              </select>
            </div>
          </div>
        </div>

        {/* Options d'impression */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
            <input
              type="checkbox"
              checked={printReceipt}
              onChange={(e) => setPrintReceipt(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
            />
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Imprimer le Bon de Restitution / Livraison SAV</span>
          </label>

          {printReceipt && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold">Format :</span>
              <button
                type="button"
                onClick={() => setPrintFormat('80mm')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer transition ${
                  printFormat === '80mm'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Ticket 80mm
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('a4')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer transition ${
                  printFormat === 'a4'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Document A4
              </button>
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-md border border-emerald-700 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: '#059669', color: '#ffffff' }}
          >
            <CheckCircle className="w-4 h-4 text-white" />
            <span className="text-white font-black">{submitting ? 'Validation en cours...' : 'Valider Sortie Téléphone & Encaisser'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
