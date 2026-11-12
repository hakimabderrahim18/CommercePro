import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, Check, X, Barcode, AlertTriangle } from 'lucide-react';

export default function PieceSearchAutocomplete({
  products = [],
  selectedProductId = '',
  onSelectProduct,
  placeholder = "Rechercher une pièce par nom, réf ou code-barre..."
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Trouver le produit sélectionné
  const selectedProduct = products.find(
    p => String(p._id || p.id) === String(selectedProductId)
  );

  // Synchroniser le libellé si un produit est déjà sélectionné
  useEffect(() => {
    if (selectedProduct) {
      setSearchTerm(selectedProduct.nom || '');
    } else if (!selectedProductId) {
      setSearchTerm('');
    }
  }, [selectedProductId, selectedProduct]);

  // Filtrer les pièces selon le terme de recherche
  const term = searchTerm.trim().toLowerCase();
  const filteredProducts = products.filter(p => {
    if (!term) return true;
    const nameMatch = (p.nom || '').toLowerCase().includes(term);
    const refMatch = (p.reference || '').toLowerCase().includes(term);
    const barcodeMatch = (p.codeBarre || '').toLowerCase().includes(term);
    return nameMatch || refMatch || barcodeMatch;
  }).slice(0, 40); // Limiter à 40 éléments pour la réactivité

  // Fermer la liste au clic extérieur
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (prod) => {
    if (!prod) {
      setSearchTerm('');
      onSelectProduct(null);
    } else {
      setSearchTerm(prod.nom || '');
      onSelectProduct(prod);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearchTerm('');
    onSelectProduct(null);
    if (inputRef.current) inputRef.current.focus();
    setIsOpen(true);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    setIsOpen(true);
    setHighlightedIndex(0);

    // Détection scan douchette immédiate si correspondance exacte avec codeBarre ou référence
    const exactBarcodeMatch = products.find(
      p => (p.codeBarre && p.codeBarre === val.trim()) ||
           (p.reference && p.reference.toLowerCase() === val.trim().toLowerCase())
    );
    if (exactBarcodeMatch) {
      handleSelect(exactBarcodeMatch);
    } else if (selectedProductId && val !== selectedProduct?.nom) {
      // Déselectionner si on tape un autre texte
      onSelectProduct(null);
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredProducts.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev > 0 ? prev - 1 : filteredProducts.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filteredProducts[highlightedIndex]) {
        handleSelect(filteredProducts[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative flex items-center">
        <div className="absolute left-3 pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full pl-9 pr-9 py-2 bg-white border rounded-xl text-xs font-bold transition-all focus:outline-none ${
            selectedProduct 
              ? 'border-emerald-500 text-slate-900 ring-2 ring-emerald-500/10' 
              : 'border-slate-300 text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
          }`}
        />

        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
            title="Effacer la recherche"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Badge de produit sélectionné avec stock en temps réel */}
      {selectedProduct && (
        <div className="mt-1 flex items-center justify-between px-2.5 py-1 bg-emerald-50/80 border border-emerald-200 rounded-lg text-[11px]">
          <div className="flex items-center gap-1.5 text-emerald-900 font-bold truncate">
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{selectedProduct.nom}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
              Number(selectedProduct.quantite || 0) > 0
                ? 'bg-emerald-200 text-emerald-900'
                : 'bg-rose-200 text-rose-900'
            }`}>
              {Number(selectedProduct.quantite || 0) > 0 
                ? `En stock : ${selectedProduct.quantite}` 
                : 'Rupture (0 en stock)'}
            </span>
            <span className="font-black text-blue-700">
              {(selectedProduct.prixVente || 0).toLocaleString('fr-DZ')} DA
            </span>
          </div>
        </div>
      )}

      {/* Menu déroulant des suggestions avec disponibilité */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
          <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider flex justify-between items-center">
            <span>Pièces & Articles disponibles ({filteredProducts.length})</span>
            <span>Disponibilité stock</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              <Package className="w-6 h-6 mx-auto mb-1 text-slate-300" />
              <span>Aucune pièce trouvée pour "{searchTerm}"</span>
            </div>
          ) : (
            filteredProducts.map((p, idx) => {
              const stock = Number(p.quantite || 0);
              const isSelected = selectedProduct && (p._id === selectedProduct._id || p.id === selectedProduct.id);
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={p._id || p.id || idx}
                  onClick={() => handleSelect(p)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                    isHighlighted ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'
                  } ${isSelected ? 'bg-emerald-50/60' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-800 truncate">
                        {p.nom}
                      </span>
                      {isSelected && (
                        <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[9px] font-bold">
                          Choisi
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                      {p.reference && <span>Réf: {p.reference}</span>}
                      {p.codeBarre && (
                        <span className="flex items-center gap-0.5">
                          <Barcode className="w-3 h-3 text-slate-400" />
                          {p.codeBarre}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {/* Badge de disponibilité */}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                      stock > 5 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : stock > 0 
                          ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      {stock <= 0 && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                      {stock > 0 ? `Dispo: ${stock}` : 'Rupture (0)'}
                    </span>

                    {/* Prix */}
                    <span className="font-black text-xs text-blue-700 min-w-[70px] text-right">
                      {(p.prixVente || 0).toLocaleString('fr-DZ')} DA
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
