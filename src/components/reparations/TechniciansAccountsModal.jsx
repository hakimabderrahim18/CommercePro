import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { 
  Users, 
  Wrench, 
  Wallet, 
  DollarSign, 
  Clock, 
  ArrowDownLeft, 
  ArrowUpRight, 
  CheckCircle, 
  RefreshCw, 
  Printer, 
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { printHtmlContent } from '../../utils/printerHelper';

export default function TechniciansAccountsModal({ isOpen, onClose, currentUser, onUpdated }) {
  const [technicians, setTechnicians] = useState([]);
  const [caisses, setCaisses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTech, setSelectedTech] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Formulaire de règlement / retrait
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawCaisse, setWithdrawCaisse] = useState('Caisse Atelier');
  const [withdrawMode, setWithdrawMode] = useState('ESPECES');
  const [withdrawMotif, setWithdrawMotif] = useState('Règlement solde technicien');
  const [savingWithdraw, setSavingWithdraw] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [techRes, caisseRes] = await Promise.all([
        api.technician.getAccounts(),
        api.caisse.getAll()
      ]);

      if (techRes && techRes.success) {
        setTechnicians(techRes.data || []);
        if (selectedTech) {
          const updatedSelected = (techRes.data || []).find(t => t.id === selectedTech.id);
          if (updatedSelected) setSelectedTech(updatedSelected);
        } else if (techRes.data && techRes.data.length > 0) {
          setSelectedTech(techRes.data[0]);
        }
      }

      if (caisseRes && caisseRes.success) {
        setCaisses(caisseRes.data || []);
        if (caisseRes.data.length > 0 && !withdrawCaisse) {
          setWithdrawCaisse(caisseRes.data[0].nom);
        }
      }
    } catch (err) {
      console.error('Erreur chargement techniciens:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async (techId) => {
    if (!techId) return;
    try {
      setLoadingMovements(true);
      const res = await api.technician.getMovements({ technicianId: techId });
      if (res && res.success) {
        setMovements(res.data || []);
      }
    } catch (err) {
      console.error('Erreur chargement mouvements technicien:', err);
    } finally {
      setLoadingMovements(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setErrorMsg('');
      setSuccessMsg('');
      setShowWithdrawForm(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedTech?.id) {
      loadMovements(selectedTech.id);
      setWithdrawAmount('');
      setShowWithdrawForm(false);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [selectedTech?.id]);

  const handleExecuteWithdrawal = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const val = parseFloat(withdrawAmount);
    if (isNaN(val) || val <= 0) {
      setErrorMsg('Veuillez saisir un montant valide supérieur à 0.');
      return;
    }

    const solde = Number(selectedTech?.soldeTechnicien || 0);
    if (val > solde) {
      if (!window.confirm(`Le montant (${val} DA) est supérieur au solde actuel du technicien (${solde} DA). Confirmez-vous ce versement en avance ?`)) {
        return;
      }
    }

    try {
      setSavingWithdraw(true);
      const res = await api.technician.payWithdrawal({
        technicianId: selectedTech.id,
        montant: val,
        caisse: withdrawCaisse,
        modePaiement: withdrawMode,
        motif: withdrawMotif
      }, currentUser);

      if (res && res.success) {
        setSuccessMsg(res.message || 'Règlement enregistré avec succès.');
        setShowWithdrawForm(false);
        setWithdrawAmount('');
        await loadData();
        await loadMovements(selectedTech.id);
        if (onUpdated) onUpdated();
        window.dispatchEvent(new CustomEvent('caisse-updated'));
        window.dispatchEvent(new CustomEvent('reparation-updated'));
      } else {
        setErrorMsg(res?.error || 'Erreur lors du règlement.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Erreur technique.');
    } finally {
      setSavingWithdraw(false);
    }
  };

  const handlePrintLedger = async () => {
    if (!selectedTech) return;
    const dateFormatted = new Date().toLocaleDateString('fr-DZ');
    const rows = movements.map(m => {
      const isGain = m.type === 'GAIN_REPARATION';
      const d = new Date(m.dateMouvement || m.created_at).toLocaleDateString('fr-DZ');
      return `
        <tr>
          <td style="padding: 4px; border: 1px solid #000;">${d}</td>
          <td style="padding: 4px; border: 1px solid #000; font-weight: bold;">${m.referenceDocument || '-'}</td>
          <td style="padding: 4px; border: 1px solid #000;">${m.motif || '-'}</td>
          <td style="padding: 4px; border: 1px solid #000; text-align: right; font-weight: bold;">
            ${isGain ? `+${Number(m.montant || 0).toLocaleString('fr-DZ')} DA` : `-${Number(m.montant || 0).toLocaleString('fr-DZ')} DA`}
          </td>
          <td style="padding: 4px; border: 1px solid #000; text-align: right; font-weight: 900;">
            ${Number(m.soldeApres || 0).toLocaleString('fr-DZ')} DA
          </td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Relevé Compte Technicien - ${selectedTech.nom}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #000; }
            h1 { font-size: 16px; margin: 0 0 4px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { border: 1px solid #000; padding: 5px; background: #eee; text-align: left; }
            .box { border: 2px solid #000; padding: 10px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h1>RELEVÉ COMPTE TECHNICIEN (ATELIER SAV)</h1>
              <p style="margin: 0;">Technicien : <b>${selectedTech.nom}</b> (${selectedTech.username})</p>
              <p style="margin: 0;">Caisse attitrée : ${selectedTech.caisse || 'Atelier'}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0;">Date : <b>${dateFormatted}</b></p>
            </div>
          </div>

          <div class="box">
            <span style="font-size: 11px; text-transform: uppercase; display: block;">SOLDE ACTUEL DÛ AU TECHNICIEN :</span>
            <span style="font-size: 22px; font-weight: 900;">${Number(selectedTech.soldeTechnicien || 0).toLocaleString('fr-DZ')} DA</span>
          </div>

          <h3>HISTORIQUE DES GAINS ET RÈGLEMENTS :</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Réf</th>
                <th>Détails / Opération</th>
                <th style="text-align: right;">Montant</th>
                <th style="text-align: right;">Solde Après</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    await printHtmlContent(html, { pageSize: 'A4' });
  };

  const totalDettesTechniciens = technicians.reduce((sum, t) => sum + Number(t.soldeTechnicien || 0), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Comptes, Commissions & Règlements des Techniciens d'Atelier"
      maxWidth="max-w-5xl"
    >
      <div className="space-y-4 text-xs">
        {/* En-tête Global & Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900 text-white p-4 rounded-2xl shadow-sm">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Techniciens</span>
            <span className="text-xl font-black text-white">{technicians.length} Technicien{technicians.length > 1 ? 's' : ''}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">Total Soldes Dûs aux Techniciens</span>
            <span className="text-xl font-black text-amber-400 font-mono">
              {totalDettesTechniciens.toLocaleString('fr-DZ')} DA
            </span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={loadData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold rounded-xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Layout : Liste des techniciens à gauche, détails et mouvements à droite */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Colonne 1 : Liste des techniciens */}
          <div className="space-y-2 border border-slate-200 rounded-2xl p-3 bg-slate-50/70 max-h-[480px] overflow-y-auto">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Techniciens ({technicians.length})
            </span>
            {technicians.map(t => {
              const isSelected = selectedTech?.id === t.id;
              const solde = Number(t.soldeTechnicien || 0);
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTech(t)}
                  className={`p-3 rounded-xl border transition cursor-pointer flex flex-col gap-1 ${
                    isSelected 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                      : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm">{t.nom}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {t.role}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={isSelected ? 'text-blue-100' : 'text-slate-500'}>
                      {t.countReparations || 0} appareil{t.countReparations > 1 ? 's' : ''} réparé{t.countReparations > 1 ? 's' : ''}
                    </span>
                    <span className={`font-mono font-black ${
                      isSelected ? 'text-amber-200' : (solde > 0 ? 'text-emerald-600' : 'text-slate-500')
                    }`}>
                      {solde.toLocaleString('fr-DZ')} DA
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Colonne 2 & 3 : Détail du technicien, Solde, Bouton Retrait & Historique */}
          <div className="md:col-span-2 space-y-3">
            {selectedTech ? (
              <>
                {/* Carte Fiche Technicien & Actions */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900">{selectedTech.nom}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">
                        {selectedTech.username}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">
                      Caisse : <b>{selectedTech.caisse || 'Non attribuée'}</b> • Total gains cumulés : <b>{(selectedTech.totalGains || 0).toLocaleString('fr-DZ')} DA</b>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-xs text-slate-400 font-bold uppercase">Solde Actuel :</span>
                      <span className="text-2xl font-black font-mono text-emerald-600">
                        {Number(selectedTech.soldeTechnicien || 0).toLocaleString('fr-DZ')} DA
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handlePrintLedger}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                      title="Imprimer le relevé du compte technicien"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimer Relevé</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowWithdrawForm(!showWithdrawForm)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>{showWithdrawForm ? 'Fermer Versement' : 'Régler le Technicien'}</span>
                    </button>
                  </div>
                </div>

                {/* Formulaire de versement / règlement technicien */}
                {showWithdrawForm && (
                  <form onSubmit={handleExecuteWithdrawal} className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3 animate-in fade-in">
                    <h4 className="text-xs font-black uppercase text-emerald-900 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>Enregistrer un Règlement au Technicien (Décaissement)</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Montant à verser (DA) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          placeholder={`Max conseillé: ${selectedTech.soldeTechnicien || 0} DA`}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-emerald-700 focus:outline-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Décaisser de la Caisse *</label>
                        <select
                          value={withdrawCaisse}
                          onChange={(e) => setWithdrawCaisse(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-emerald-500"
                        >
                          {caisses.map(c => (
                            <option key={c.id || c.nom} value={c.nom}>{c.nom} (Solde: {Number(c.soldeActuel || 0).toLocaleString('fr-DZ')} DA)</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Mode de Paiement</label>
                        <select
                          value={withdrawMode}
                          onChange={(e) => setWithdrawMode(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-emerald-500"
                        >
                          <option value="ESPECES">Espèces</option>
                          <option value="VIREMENT">Virement / CCP</option>
                          <option value="CHEQUE">Chèque</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Motif / Commentaire</label>
                      <input
                        type="text"
                        value={withdrawMotif}
                        onChange={(e) => setWithdrawMotif(e.target.value)}
                        placeholder="Règlement gains réparations"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-emerald-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowWithdrawForm(false)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={savingWithdraw}
                        className="px-4 py-1.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {savingWithdraw ? 'Validation...' : 'Valider le Décaissement & Paiement'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Tableau Historique des mouvements */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-black text-slate-700 text-xs uppercase tracking-wider">
                      Historique des Opérations & Gains ({movements.length})
                    </span>
                    {loadingMovements && <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />}
                  </div>

                  <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10 uppercase text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Appareil / Référence</th>
                          <th className="py-2 px-3 text-right">Montant</th>
                          <th className="py-2 px-3 text-right">Solde Après</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {movements.length > 0 ? (
                          movements.map(m => {
                            const isGain = m.type === 'GAIN_REPARATION';
                            const isRetrait = m.type === 'RETRAIT';
                            return (
                              <tr key={m.id} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                                  {new Date(m.dateMouvement || m.created_at).toLocaleDateString('fr-DZ', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                  })}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                    isGain ? 'bg-emerald-100 text-emerald-800' : isRetrait ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {isGain ? 'Gain MO' : isRetrait ? 'Retrait' : m.type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                  <div>{m.referenceDocument || '-'}</div>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[220px]">
                                    {m.motif || (m.appareilType ? `${m.appareilType} ${m.marque} ${m.modele}` : '')}
                                  </div>
                                </td>
                                <td className={`py-2.5 px-3 text-right font-mono font-black ${
                                  isGain ? 'text-emerald-600' : 'text-rose-600'
                                }`}>
                                  {isGain ? `+${Number(m.montant || 0).toLocaleString('fr-DZ')}` : `-${Number(m.montant || 0).toLocaleString('fr-DZ')}`} DA
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                  {Number(m.soldeApres || 0).toLocaleString('fr-DZ')} DA
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              Aucune opération enregistrée pour ce technicien.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                Sélectionnez un technicien pour afficher son compte et ses gains.
              </div>
            )}
          </div>
        </div>

        {/* Bouton Fermer */}
        <div className="flex justify-end pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
}
