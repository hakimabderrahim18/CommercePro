import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { FileSpreadsheet, CheckSquare, Square, Check, RefreshCw, Search, Download } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function ExportColumnsModal({
  isOpen,
  onClose,
  title,
  availableColumns = [],
  onConfirm
}) {
  const { t, isRTL } = useLanguage();
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Par défaut, cocher toutes les colonnes ou celles avec defaultChecked !== false
      const initial = new Set(
        availableColumns
          .filter(c => c.defaultChecked !== false)
          .map(c => c.key)
      );
      setSelectedKeys(initial);
      setSearch('');
      setExporting(false);
    }
  }, [isOpen, availableColumns]);

  if (!isOpen) return null;

  const toggleKey = (key) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedKeys(next);
  };

  const selectAll = () => {
    setSelectedKeys(new Set(availableColumns.map(c => c.key)));
  };

  const deselectAll = () => {
    setSelectedKeys(new Set());
  };

  const selectRecommended = () => {
    const rec = new Set(
      availableColumns
        .filter(c => c.defaultChecked !== false)
        .map(c => c.key)
    );
    setSelectedKeys(rec);
  };

  const handleExport = async () => {
    if (selectedKeys.size === 0) {
      alert('Veuillez sélectionner au moins un attribut à exporter.');
      return;
    }

    try {
      setExporting(true);
      await onConfirm(Array.from(selectedKeys));
      onClose();
    } catch (err) {
      console.error('Erreur export:', err);
      alert(err.message || 'Erreur lors de l’export Excel');
    } finally {
      setExporting(false);
    }
  };

  // Grouper les colonnes par groupe si disponible
  const filteredColumns = availableColumns.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase()) ||
    c.key.toLowerCase().includes(search.toLowerCase()) ||
    (c.group && c.group.toLowerCase().includes(search.toLowerCase()))
  );

  const groups = {};
  filteredColumns.forEach(c => {
    const grp = c.group || 'Général';
    if (!groups[grp]) groups[grp] = [];
    groups[grp].push(c);
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || 'Personnaliser les Colonnes d’Exportation Excel'}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Intro */}
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200/80 p-3 rounded-xl text-emerald-900 text-xs">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Sélectionnez les attributs à faire figurer dans votre fichier Excel personnalisé.</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full font-black bg-emerald-200 text-emerald-800 text-[11px]">
            {selectedKeys.size} / {availableColumns.length}
          </span>
        </div>

        {/* Search & Quick Select Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer attributs..."
              className="w-full pl-8 pr-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={selectAll}
              className="px-2 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
            >
              Tout cocher
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="px-2 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
            >
              Tout décocher
            </button>
            <button
              type="button"
              onClick={selectRecommended}
              className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer"
            >
              Par défaut
            </button>
          </div>
        </div>

        {/* Columns Grid Grouped */}
        <div className="max-h-[50vh] overflow-y-auto space-y-4 p-1">
          {Object.keys(groups).map((grpName) => (
            <div key={grpName} className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                {grpName}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {groups[grpName].map((col) => {
                  const isChecked = selectedKeys.has(col.key);
                  return (
                    <label
                      key={col.key}
                      onClick={() => toggleKey(col.key)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer select-none ${
                        isChecked
                          ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center transition ${
                        isChecked ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white'
                      }`}>
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block truncate font-bold">{col.label}</span>
                        <span className="block text-[10px] text-slate-400 font-mono">{col.key}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredColumns.length === 0 && (
            <div className="text-center py-6 text-xs text-slate-400">
              Aucun attribut ne correspond à votre recherche.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <span className="text-xs text-slate-500 font-medium">
            <strong className="text-slate-800">{selectedKeys.size}</strong> attribut(s) sélectionné(s)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || selectedKeys.size === 0}
              className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-black rounded-xl text-white transition shadow-md cursor-pointer ${
                selectedKeys.size > 0 && !exporting
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Génération du fichier...' : 'Exporter le Fichier Excel'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
