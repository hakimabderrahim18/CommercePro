import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { 
  Search, 
  RotateCcw, 
  Truck, 
  Eye, 
  X, 
  FileText, 
  Calendar, 
  User, 
  DollarSign, 
  AlertCircle,
  Printer,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { api } from '../../services/api';
import { printHtmlContent, generateReceiptHtml, generateA4InvoiceHtml, getPrinterSettings } from '../../utils/printerHelper';

export default function BonSearchBar({ onSelectInvoiceForReturn, onSelectInvoiceForDetail }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState(null);
  const [dropdownCoords, setDropdownCoords] = useState(null);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const updateDropdownCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownCoords({
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(380, rect.width)
      });
    }
  };

  // Fermer la recherche si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(e.target) &&
        !e.target.closest?.('.bon-search-portal-dropdown')
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateDropdownCoords();
      window.addEventListener('resize', updateDropdownCoords);
      window.addEventListener('scroll', updateDropdownCoords, true);
      return () => {
        window.removeEventListener('resize', updateDropdownCoords);
        window.removeEventListener('scroll', updateDropdownCoords, true);
      };
    }
  }, [isOpen, query]);

  // Recherche debouncée
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.invoice.getAll({ search: trimmed, limit: 8 });
        if (res.success && Array.isArray(res.data)) {
          setResults(res.data);
          setIsOpen(true);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error('Erreur recherche bon:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Récupère la facture complète avec ses lignes d'articles
  const fetchFullInvoice = async (invoiceSummary) => {
    try {
      const res = await api.invoice.getById(invoiceSummary.id || invoiceSummary._id || invoiceSummary.numeroFacture);
      if (res.success && res.data) {
        return res.data;
      }
    } catch (e) {
      console.warn('Impossible de charger le détail complet:', e);
    }
    return invoiceSummary;
  };

  // Action 1: Déclencher un retour sur ce bon
  const handleTriggerReturn = async (inv, e) => {
    e.stopPropagation();
    setIsOpen(false);
    const full = await fetchFullInvoice(inv);
    if (onSelectInvoiceForReturn) {
      onSelectInvoiceForReturn(full);
    }
  };

  // Action 2: Imprimer / Éditer Bon de Livraison (BL)
  const handlePrintDeliverySlip = async (inv, e) => {
    e.stopPropagation();
    try {
      const full = await fetchFullInvoice(inv);
      const settings = getPrinterSettings();
      // Générer le reçu au format Bon de Livraison (80mm) ou A4
      const html = generateReceiptHtml({
        invoice: full,
        docType: 'BON_LIVRAISON',
        settings
      });
      await printHtmlContent(html, { silent: true });
      setActiveFeedback(`Bon de Livraison ${full.numeroFacture} envoyé à l'impression`);
      setTimeout(() => setActiveFeedback(null), 3500);
    } catch (err) {
      console.error(err);
    }
  };

  // Action 3: Consulter le détail du bon
  const handleViewDetail = async (inv, e) => {
    e.stopPropagation();
    setIsOpen(false);
    const full = await fetchFullInvoice(inv);
    if (onSelectInvoiceForDetail) {
      onSelectInvoiceForDetail(full);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const dropdownContent = isOpen && dropdownCoords && (
    <div 
      style={{
        position: 'fixed',
        top: `${dropdownCoords.top}px`,
        left: `${dropdownCoords.left}px`,
        width: `${dropdownCoords.width}px`,
        zIndex: 9999
      }}
      className="bon-search-portal-dropdown bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-150"
    >
      <div className="px-3.5 py-2 bg-slate-50/80 flex items-center justify-between border-b border-slate-200">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-blue-600" />
          <span>Bons trouvés ({results.length})</span>
        </span>
        <span className="text-[10px] font-semibold text-slate-400">
          Tapez Entrée pour le 1er résultat
        </span>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
        {loading && (
          <div className="p-4 text-center text-xs font-semibold text-slate-500 flex items-center justify-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Recherche en cours...</span>
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="p-4 text-center text-xs font-semibold text-slate-500">
            Aucun Bon de Commande ou Facture trouvé pour <span className="font-bold text-slate-700">"{query}"</span>.
          </div>
        )}

        {!loading && results.map((inv) => {
          const isOrder = inv.typeDocument === 'BON_COMMANDE';
          const dateStr = new Date(inv.dateFacture || inv.created_at || Date.now()).toLocaleDateString('fr-DZ', {
            day: '2-digit', month: '2-digit', year: 'numeric'
          });
          const clientName = inv.client_nom_db || inv.nomClientLibre || inv.clientLibre || 'Client Comptoir';
          const total = Number(inv.totalTTC || inv.totalHT || 0);

          return (
            <div
              key={inv.id || inv._id || inv.numeroFacture}
              className="p-3 hover:bg-blue-50/50 transition flex items-center justify-between gap-3 group"
            >
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-xs text-slate-900 group-hover:text-blue-600 transition">
                    {inv.numeroFacture}
                  </span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase ${
                    isOrder ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {isOrder ? 'Bon de Commande' : 'Facture / BL'}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {dateStr}
                  </span>
                </div>

                <div className="text-xs text-slate-600 font-semibold flex items-center gap-2 mt-0.5 truncate">
                  <span className="text-slate-800 font-bold truncate">👤 {clientName}</span>
                  <span className="text-slate-400">•</span>
                  <span className="font-mono font-black text-emerald-700">{total.toLocaleString('fr-DZ')} DA</span>
                  {inv.caisse && (
                    <>
                      <span className="text-slate-400">•</span>
                      <span className="text-[10px] text-slate-500 font-bold">Caisse : {inv.caisse}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions Rapides sur ce Bon */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Bouton Retour / Avoir */}
                <button
                  type="button"
                  onClick={(e) => handleTriggerReturn(inv, e)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                  title="Créer un retour / Avoir sur ce bon"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                  <span>Retour</span>
                </button>

                {/* Bouton Bon de Livraison (BL) */}
                <button
                  type="button"
                  onClick={(e) => handlePrintDeliverySlip(inv, e)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                  title="Imprimer ou consulter le Bon de Livraison"
                >
                  <Truck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>BL</span>
                </button>

                {/* Bouton Détail */}
                <button
                  type="button"
                  onClick={(e) => handleViewDetail(inv, e)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  title="Afficher le détail de la facture"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="relative min-w-[260px] md:min-w-[320px] max-w-md flex-1 shrink-0">
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <div className="absolute left-3 flex items-center pointer-events-none text-blue-600">
          <Search className="w-4 h-4" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsOpen(false);
            if (e.key === 'Enter' && results.length > 0) {
              handleTriggerReturn(results[0], e);
            }
          }}
          placeholder="Chercher un Bon de commande / BL pour retour ou opération (N°, Client)..."
          className="w-full pl-9 pr-9 py-2 bg-slate-100 hover:bg-slate-50 focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-500 placeholder:font-medium transition-all shadow-inner focus:ring-2 focus:ring-blue-500/20"
        />

        {query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition cursor-pointer"
            title="Effacer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span className="absolute right-2.5 hidden md:inline-flex px-1.5 py-0.5 text-[9px] font-bold text-slate-400 bg-slate-200/70 rounded border border-slate-300">
            Retour / BL
          </span>
        )}
      </div>

      {activeFeedback && (
        <div className="absolute top-full left-0 right-0 mt-1 px-3 py-1.5 bg-emerald-600 text-white text-[11px] font-bold rounded-lg shadow-lg z-50 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{activeFeedback}</span>
        </div>
      )}

      {/* Portal Dropdown Menu */}
      {typeof document !== 'undefined' && dropdownContent && ReactDOM.createPortal(dropdownContent, document.body)}
    </div>
  );
}
