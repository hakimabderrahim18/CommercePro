import React, { useRef } from 'react';
import { ShoppingCart, PlusCircle, Truck, Globe, Wallet, AlertOctagon, Printer, User, Sliders, CloudDownload } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import BonSearchBar from './BonSearchBar';

export default function Topbar({ 
  onNewSale, 
  onNewPurchase, 
  onNewProduct, 
  onNewEncaissement, 
  onNewLoss, 
  onOpenPrinterSettings, 
  onOpenUpdateModal,
  hasUpdate = false,
  title, 
  subtitle,
  onSelectInvoiceForReturn,
  onSelectInvoiceForDetail
}) {
  const { language, toggleLanguage, t } = useLanguage();
  const { currentUser } = useAuth();
  const headerRef = useRef(null);

  const handleWheel = (e) => {
    if (e.deltaY !== 0 && headerRef.current) {
      headerRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <header 
      ref={headerRef}
      onWheel={handleWheel}
      className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 shrink-0 select-none shadow-xs z-20 overflow-x-auto whitespace-nowrap min-w-0"
      style={{ scrollbarWidth: 'thin' }}
    >
      {/* Title & Modern Crisp Subtitle Badge */}
      <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
        <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">
          {title}
        </h1>
        {subtitle && (
          <span className="hidden xl:inline-flex items-center px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-blue-50 text-blue-800 border border-blue-200/70 leading-none shadow-2xs">
            {subtitle}
          </span>
        )}
      </div>

      {/* Input Central de Recherche de Bon de Commande / BL (pour Retour ou Opérations) */}
      <div className="shrink-0 flex items-center">
        <BonSearchBar
          onSelectInvoiceForReturn={onSelectInvoiceForReturn}
          onSelectInvoiceForDetail={onSelectInvoiceForDetail}
        />
      </div>

      {/* Actions & Utilisateur Container (Horizontalement aligné avec overflow sécurisé) */}
      <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
        {/* User Active Caisse Badge */}
        {currentUser && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs shrink-0 whitespace-nowrap shadow-2xs">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-bold text-slate-800">{currentUser.nom || currentUser.username}</span>
            <span className={`px-1.5 py-0.5 rounded font-black text-[10px] uppercase ${
              currentUser.role === 'ADMIN' ? 'bg-blue-100 text-blue-800' :
              currentUser.role === 'REPARATEUR' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>{currentUser.role}</span>
            <span className="text-slate-500 font-semibold">• {currentUser.caisse || 'Caisse'}</span>
          </div>
        )}

        <div className="h-5 w-px bg-slate-200 shrink-0 mx-0.5" />

        {/* Settings Button (Printers & Appearance Theme) */}
        {onOpenPrinterSettings && (
          <button
            type="button"
            onClick={onOpenPrinterSettings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer shadow-2xs shrink-0 whitespace-nowrap"
            title="Paramètres : Couleurs de l'application, imprimantes SPRT & Xprinter"
          >
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Paramètres</span>
          </button>
        )}

        {/* Update Button (GitHub Releases) */}
        {onOpenUpdateModal && (
          <button
            type="button"
            onClick={onOpenUpdateModal}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer shadow-2xs shrink-0 whitespace-nowrap ${
              hasUpdate
                ? 'bg-blue-50 border-blue-300 text-blue-700 animate-pulse'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title="Vérifier et télécharger les mises à jour en ligne"
          >
            <CloudDownload className={`w-4 h-4 ${hasUpdate ? 'text-blue-600' : 'text-slate-500'}`} />
            <span>Mise à jour</span>
            {hasUpdate && (
              <span className="w-2 h-2 rounded-full bg-blue-600 absolute -top-1 -right-1 ring-2 ring-white animate-ping" />
            )}
          </button>
        )}

        {/* Language Switcher */}
        <button
          type="button"
          onClick={toggleLanguage}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer shadow-2xs shrink-0 whitespace-nowrap"
          title="Changer de langue / تغيير اللغة"
        >
          <Globe className="w-4 h-4 text-blue-600" />
          <span className="font-black">{language === 'fr' ? 'العربية 🇩🇿' : 'Français 🇫🇷'}</span>
        </button>

        <div className="h-5 w-px bg-slate-200 shrink-0 mx-0.5" />

        {/* Quick Action: New Loss (Admin only) */}
        {currentUser?.role === 'ADMIN' && onNewLoss && (
          <button
            onClick={onNewLoss}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
          >
            <AlertOctagon className="w-4 h-4 text-rose-600" />
            <span>{t('top_newLoss')}</span>
          </button>
        )}

        {/* Quick Action: New Encaissement / Caisse (Admin only) */}
        {currentUser?.role === 'ADMIN' && onNewEncaissement && (
          <button
            onClick={onNewEncaissement}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl transition shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Wallet className="w-4 h-4 text-emerald-600" />
            <span>{t('top_newEncaissement')}</span>
          </button>
        )}

        {/* Quick Action: New Product (Admin only) */}
        {currentUser?.role === 'ADMIN' && onNewProduct && (
          <button
            onClick={onNewProduct}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer shrink-0 whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4 text-slate-600" />
            <span>{t('top_newProduct')}</span>
          </button>
        )}

        {/* Quick Action: New Purchase Invoice (Fournisseur - Admin only) */}
        {currentUser?.role === 'ADMIN' && onNewPurchase && (
          <button
            onClick={onNewPurchase}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl transition shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Truck className="w-4 h-4 text-indigo-600" />
            <span>{t('top_newPurchase')}</span>
          </button>
        )}

        {/* Quick Action: New Sale (POS / Vente) */}
        <button
          onClick={onNewSale}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/20 cursor-pointer shrink-0 whitespace-nowrap"
        >
          <ShoppingCart className="w-4 h-4 text-white" />
          <span>{t('top_newSale')}</span>
        </button>
      </div>
    </header>
  );
}
