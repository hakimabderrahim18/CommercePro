/**
 * Global input enhancements:
 * 1. Automatic zero selection on number inputs upon focus/click so typing replaces '0' instantly.
 * 2. Non-intrusive to React's controlled inputs and synthetic event system.
 */
export function initGlobalInputEnhancements() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 1. Focus: select the entire value so typing replaces it immediately
  document.addEventListener('focus', (e) => {
    const el = e.target;
    if (el && el.tagName === 'INPUT' && (el.type === 'number' || el.inputMode === 'numeric' || el.inputMode === 'decimal')) {
      setTimeout(() => {
        try {
          if (document.activeElement === el) {
            el.select();
          }
        } catch (err) {}
      }, 30);
    }
  }, true);

  // 2. Click / Mouseup: ensure selection is maintained if the value is '0'
  document.addEventListener('mouseup', (e) => {
    const el = e.target;
    if (el && el.tagName === 'INPUT' && (el.type === 'number' || el.inputMode === 'numeric' || el.inputMode === 'decimal')) {
      const v = String(el.value || '').trim();
      if (v === '0' || v === '0.00' || v === '0.000') {
        setTimeout(() => {
          try {
            if (document.activeElement === el) {
              el.select();
            }
          } catch (err) {}
        }, 15);
      }
    }
  }, true);
}
