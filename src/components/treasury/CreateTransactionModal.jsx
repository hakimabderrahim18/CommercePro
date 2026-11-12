import React, { useState, useEffect } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, DollarSign, User, Building, FileText, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

export default function CreateTransactionModal({ isOpen, onClose, initialType = 'ENCAISSEMENT', onSuccess }) {
  const { t, isRTL } = useLanguage();
  if (!isOpen) return null;

  const [type, setType] = useState(initialType);
  const [montant, setMontant] = useState('');
  const [modePaiement, setModePaiement] = useState('ESPECES');
  const [caisses, setCaisses] = useState([]);
  const [caisse, setCaisse] = useState('Caisse 1');
  const [categorie, setCategorie] = useState(initialType === 'ENCAISSEMENT' ? 'REGLEMENT_CLIENT' : 'DEPENSE_LOYER');
  const [customCategories, setCustomCategories] = useState([]);
  const [isFreeCategory, setIsFreeCategory] = useState(false);
  const [freeCategoryName, setFreeCategoryName] = useState('');
  const [tiers, setTiers] = useState('');
  const [clientId, setClientId] = useState('');
  const [isFreeClient, setIsFreeClient] = useState(false);
  const [fournisseur, setFournisseur] = useState('');
  const [referenceDocument, setReferenceDocument] = useState('');
  const [motif, setMotif] = useState('');
  const [deduireDetteClient, setDeduireDetteClient] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [showTiersSuggestions, setShowTiersSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load customers, suppliers, caisses, and custom categories
  useEffect(() => {
    async function loadData() {
      try {
        const [custRes, suppRes, caisseRes, catRes] = await Promise.all([
          api.customer.getAll(),
          api.supplier ? api.supplier.getAll() : Promise.resolve({ success: false }),
          api.caisse ? api.caisse.getAll() : Promise.resolve({ success: false }),
          api.categories ? api.categories.getAll() : Promise.resolve({ success: false })
        ]);
        if (custRes.success) setCustomers(custRes.data || []);
        if (suppRes && suppRes.success) setSuppliers(suppRes.data || []);
        if (caisseRes.success && caisseRes.data && caisseRes.data.length > 0) {
          setCaisses(caisseRes.data);
          setCaisse(caisseRes.data[0].nom);
        }
        if (catRes.success && catRes.data) {
          setCustomCategories(catRes.data);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadData();
  }, []);

  // Update default category when type changes
  const handleTypeChange = (newType) => {
    setType(newType);
    setIsFreeCategory(false);
    if (newType === 'ENCAISSEMENT') {
      setCategorie('REGLEMENT_CLIENT');
    } else {
      setCategorie('DEPENSE_LOYER');
    }
  };

  const handleCustomerChange = (cId) => {
    setClientId(cId);
    if (cId) {
      const cust = customers.find(c => String(c._id || c.id) === String(cId));
      if (cust) {
        setTiers(cust.nom);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const val = parseFloat(montant);
    if (isNaN(val) || val <= 0) {
      setError('Veuillez saisir un montant valide supérieur à 0.');
      return;
    }

    setLoading(true);
    try {
      const finalCategory = isFreeCategory ? (freeCategoryName.trim() || 'DIVERS') : categorie;

      const res = await api.treasury.create({
        type,
        montant: val,
        modePaiement,
        caisse,
        categorie: finalCategory,
        tiers: tiers.trim() || (type === 'ENCAISSEMENT' ? 'Client Divers' : 'Fournisseur / Prestataire'),
        client_id: clientId || null,
        fournisseur: fournisseur.trim() || (type === 'DECAISSEMENT' && tiers ? tiers : ''),
        referenceDocument: referenceDocument.trim(),
        motif: motif.trim(),
        deduireDetteClient
      });

      if (res.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setError(res.error || 'Erreur lors de l’enregistrement de la transaction.');
      }
    } catch (err) {
      setError(err.message || 'Erreur inattendue.');
    } finally {
      setLoading(false);
    }
  };

  const isInflow = type === 'ENCAISSEMENT';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 modal-backdrop"
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-content modal-container bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className={`px-6 py-4.5 text-white flex items-center justify-between transition-colors ${
          isInflow 
            ? 'bg-gradient-to-r from-emerald-600 to-teal-700' 
            : 'bg-gradient-to-r from-rose-600 to-red-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
              {isInflow ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                {isInflow ? t('tre_modalTitleInflow') : t('tre_modalTitleOutflow')}
              </h3>
              <p className="text-xs text-white/80 font-medium">{t('tre_receiptSubtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
              {error}
            </div>
          )}

          {/* Type Toggle Switch */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => handleTypeChange('ENCAISSEMENT')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                isInflow 
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>{t('tre_tabInflows')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleTypeChange('DECAISSEMENT')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                !isInflow 
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{t('tre_tabOutflows')}</span>
            </button>
          </div>

          {/* Montant, Mode de Paiement & Caisse */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('tre_amount')} ({t('currency')}) *
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:bg-white focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('tre_method')} *
              </label>
              <select
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-blue-500 cursor-pointer"
              >
                <option value="ESPECES">{t('pos_cash')}</option>
                <option value="CHEQUE">{t('pos_check')}</option>
                <option value="VIREMENT">{t('pos_transfer')}</option>
                <option value="CARTE">{t('pos_card')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('pos_selectCaisse') || 'Caisse'} *
              </label>
              <select
                value={caisse}
                onChange={(e) => setCaisse(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-blue-500 cursor-pointer"
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
            </div>
          </div>

          {/* Catégorie & Catégorie Libre */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                {t('tre_category')} *
              </label>
              <button
                type="button"
                onClick={() => setIsFreeCategory(!isFreeCategory)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer underline"
              >
                {isFreeCategory ? 'Choisir dans la liste' : '+ Catégorie libre (personnalisée)'}
              </button>
            </div>

            {isFreeCategory ? (
              <input
                type="text"
                required
                value={freeCategoryName}
                onChange={(e) => setFreeCategoryName(e.target.value)}
                placeholder="Ex: Facture Internet, Loyer Dépôt, Réparation climatiseur..."
                className="w-full px-3.5 py-2.5 bg-blue-50/50 border border-blue-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-blue-500"
              />
            ) : (
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-blue-500 cursor-pointer"
              >
                {isInflow ? (
                  <>
                    <option value="REGLEMENT_CLIENT">{t('tre_cat_reglementClient')}</option>
                    <option value="VENTE_DIRECTE">{t('tre_cat_venteDirecte')}</option>
                    <option value="AUTRE_ENCAISSEMENT">{t('tre_cat_autreEncaissement')}</option>
                    {customCategories.filter(c => c.type === 'ENCAISSEMENT').map(c => (
                      <option key={c.id || c.nom} value={c.nom}>{c.nom}</option>
                    ))}
                  </>
                ) : (
                  <>
                    <option value="DEPENSE_LOYER">{t('tre_cat_loyer')}</option>
                    <option value="REGLEMENT_FOURNISSEUR">{t('tre_cat_reglementFournisseur')}</option>
                    <option value="SALAIRE">{t('tre_cat_salaire')}</option>
                    <option value="ELECTRICITE_EAU">{t('tre_cat_electriciteEau')}</option>
                    <option value="TRANSPORT">{t('tre_cat_transport')}</option>
                    <option value="ACHAT_MATERIEL">{t('tre_cat_achatMateriel')}</option>
                    <option value="AUTRE_DECAISSEMENT">{t('tre_cat_autreDecaissement')}</option>
                    {customCategories.filter(c => c.type === 'DECAISSEMENT').map(c => (
                      <option key={c.id || c.nom} value={c.nom}>{c.nom}</option>
                    ))}
                  </>
                )}
              </select>
            )}
          </div>

          {/* If Inflow with Client Debt settlement option */}
          {isInflow && (
            <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-blue-900">
                  {t('tre_selectCustomerOptional')}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsFreeClient(!isFreeClient);
                    if (!isFreeClient) {
                      setClientId('');
                    }
                  }}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer underline"
                >
                  {isFreeClient ? 'Choisir dans la liste' : '+ Saisie libre (Nom client)'}
                </button>
              </div>

              {isFreeClient ? (
                <div className="relative">
                  <input
                    type="text"
                    value={tiers}
                    onChange={(e) => {
                      setTiers(e.target.value);
                      setShowClientSuggestions(true);
                    }}
                    onFocus={() => setShowClientSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowClientSuggestions(false), 250)}
                    placeholder="Ex: Mohamed Benali, Client Comptoir..."
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-blue-500"
                  />
                  {showClientSuggestions && tiers.trim().length > 0 && (
                    <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-blue-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {customers
                        .filter(c => (c.nom && c.nom.toLowerCase().includes(tiers.toLowerCase())) || (c.telephone && c.telephone.includes(tiers)))
                        .slice(0, 8)
                        .map(c => (
                          <div
                            key={c._id || c.id}
                            onMouseDown={() => {
                              setTiers(c.nom);
                              setClientId(c._id || c.id);
                              setShowClientSuggestions(false);
                            }}
                            className="p-2 hover:bg-blue-50/80 cursor-pointer flex items-center justify-between text-xs transition"
                          >
                            <div>
                              <div className="font-bold text-slate-800">{c.nom}</div>
                              <div className="text-[10px] text-slate-500">{c.telephone ? `Tél: ${c.telephone}` : ''}</div>
                            </div>
                            <div className="text-[10px] font-bold text-blue-600">
                              Dette: {Number(c.soldeDette || 0).toLocaleString('fr-DZ')} DA
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <select
                  value={clientId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-blue-500 cursor-pointer"
                >
                  <option value="">-- {t('pos_counterClient')} --</option>
                  {customers.map((c) => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.nom} ({t('cust_debtBalance')}: {Number(c.soldeDette || 0).toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')})
                    </option>
                  ))}
                </select>
              )}

              {clientId && !isFreeClient && (
                <label className="flex items-center gap-2 text-xs font-bold text-blue-800 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={deduireDetteClient}
                    onChange={(e) => setDeduireDetteClient(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>{t('tre_deductClientDebt')}</span>
                </label>
              )}
            </div>
          )}

          {/* Tiers / Bénéficiaire */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('tre_tiers')}
            </label>
            <input
              type="text"
              value={tiers}
              onChange={(e) => {
                setTiers(e.target.value);
                setShowTiersSuggestions(true);
              }}
              onFocus={() => setShowTiersSuggestions(true)}
              onBlur={() => setTimeout(() => setShowTiersSuggestions(false), 250)}
              placeholder={isInflow ? 'Nom du client ou payeur' : 'Nom du bénéficiaire, propriétaire, fournisseur...'}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
            />
            {showTiersSuggestions && tiers.trim().length > 0 && (
              <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                {(isInflow ? customers : suppliers)
                  .filter(item => (item.nom && item.nom.toLowerCase().includes(tiers.toLowerCase())) || (item.telephone && item.telephone.includes(tiers)))
                  .slice(0, 8)
                  .map(item => (
                    <div
                      key={item._id || item.id}
                      onMouseDown={() => {
                        setTiers(item.nom);
                        if (isInflow) {
                          setClientId(item._id || item.id);
                        } else {
                          setFournisseur(item.nom);
                        }
                        setShowTiersSuggestions(false);
                      }}
                      className="p-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{item.nom}</div>
                        <div className="text-[10px] text-slate-500">{item.telephone ? `Tél: ${item.telephone}` : ''}</div>
                      </div>
                      <div className="text-[10px] font-bold text-blue-600">
                        {isInflow 
                          ? `Dette: ${Number(item.soldeDette || 0).toLocaleString('fr-DZ')} DA` 
                          : (item.soldeDette ? `Dette: ${Number(item.soldeDette).toLocaleString('fr-DZ')} DA` : '')}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Référence Document & Motif */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('tre_refDoc')}
              </label>
              <input
                type="text"
                value={referenceDocument}
                onChange={(e) => setReferenceDocument(e.target.value)}
                placeholder="Ex: Facture 45, Chèque BNA 88, Quittance..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('tre_motif')}
              </label>
              <input
                type="text"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Description sommaire de l’opération"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              {t('cancel')}
            </button>

            <button
              type="submit"
              disabled={loading}
              className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 ${
                isInflow 
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' 
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>{loading ? t('loading') : isInflow ? t('tre_newInflow') : t('tre_newOutflow')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
