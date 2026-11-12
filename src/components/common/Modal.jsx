import React, { useState, useEffect } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl', closeOnBackdropClick = false }) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset maximized on open/close
  useEffect(() => {
    if (!isOpen) setIsMaximized(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDownCapture = (e) => {
    // Empêche la fermeture brutale ou la soumission prématurée des formulaires lors de la frappe d'Entrée ou scan douchette
    if (
      e.key === 'Enter' &&
      e.target &&
      e.target.tagName === 'INPUT' &&
      !['submit', 'button'].includes(e.target.type) &&
      e.target.getAttribute('data-allow-enter') !== 'true'
    ) {
      e.preventDefault();
      // Passe proprement au champ suivant s'il existe dans le formulaire
      const form = e.target.form;
      if (form) {
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
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200 modal-backdrop"
      role="dialog"
      aria-modal="true"
      onKeyDownCapture={handleKeyDownCapture}
    >
      <div 
        className="fixed inset-0" 
        onClick={closeOnBackdropClick ? onClose : undefined} 
      />
      
      <div 
        style={!isMaximized ? { resize: 'both' } : {}}
        className={`modal-content modal-container relative w-full ${
          isMaximized 
            ? 'w-[98vw] h-[96vh] max-w-none max-h-none rounded-2xl' 
            : `${maxWidth} min-w-[320px] max-h-[92vh] rounded-2xl`
        } bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden z-10 animate-in zoom-in-95 duration-150`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 select-none shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight truncate pr-2">{title}</h2>
          
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              title={isMaximized ? "Réduire la taille" : "Agrandir en plein écran"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Fermer (Échap)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}
