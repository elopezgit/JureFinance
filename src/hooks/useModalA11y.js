// useModalA11y.js - Cierra con Escape, mueve el foco al abrir y lo atrapa
// mientras el modal está visible. Se usa en todos los diálogos de la app.
import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

export function useModalA11y(open, onClose, containerRef) {
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement;
    const root = containerRef.current;
    const items = () => (root ? Array.from(root.querySelectorAll(FOCUSABLE)) : []);
    const frame = requestAnimationFrame(() => {
      const first = items()[0] || root;
      first?.focus?.();
    });

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = items();
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown, true);
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose, containerRef]);
}

export default useModalA11y;
