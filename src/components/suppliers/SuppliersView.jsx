import React, { useState } from 'react';
import { 
  Building, 
  Plus, 
  ShoppingCart, 
  CreditCard, 
  ArrowUpRight 
} from 'lucide-react';
import SuppliersTab from './SuppliersTab';
import SupplierModal from './SupplierModal';
import CreatePurchaseModal from '../purchases/CreatePurchaseModal';
import CreateTransactionModal from '../treasury/CreateTransactionModal';
import { useLanguage } from '../../context/LanguageContext';

export default function SuppliersView() {
  const { t } = useLanguage();
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isDecaissementModalOpen, setIsDecaissementModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Building className="w-6 h-6 text-indigo-600" />
            <span>Gestion des Fournisseurs & Achats</span>
          </h2>
          <p className="text-xs text-slate-500 font-semibold">
            Fiches fournisseurs, suivi des dettes, relevés de compte et enregistrement des règlements (décaissements)
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsPurchaseModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>+ Bon d'Achat (Facture)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDecaissementModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            <span>- Décaissement Fournisseur</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSupplierModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nouveau Fournisseur</span>
          </button>
        </div>
      </div>

      {/* Main Suppliers Tab */}
      <SuppliersTab 
        key={refreshKey}
        onNewPurchase={() => setIsPurchaseModalOpen(true)} 
      />

      {/* New Supplier Modal */}
      <SupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        onSaved={handleRefresh}
      />

      {/* New Purchase Modal */}
      <CreatePurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onPurchaseCreated={handleRefresh}
      />

      {/* Decaissement Modal */}
      <CreateTransactionModal
        isOpen={isDecaissementModalOpen}
        onClose={() => setIsDecaissementModalOpen(false)}
        initialType="DECAISSEMENT"
        onSuccess={handleRefresh}
      />
    </div>
  );
}
