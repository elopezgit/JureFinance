// ConfirmDialog.jsx - Confirmación accesible para acciones destructivas.
import React, { useId, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useModalA11y } from '../../hooks/useModalA11y';

export default function ConfirmDialog({
  open,
  title = 'Confirmar acción',
  message,
  warning,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel
}) {
  const titleId = useId();
  const messageId = useId();
  const rootRef = useRef(null);
  useModalA11y(open, onCancel, rootRef);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}>
      <div
        ref={rootRef}
        className="modal-content jf-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onConfirm?.(); }}
      >
        <div className="modal-header">
          <div className="card-title-group">
            <div className="card-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', borderColor: 'var(--warning-border)' }}>
              <AlertTriangle size={18} />
            </div>
            <h3 id={titleId} className="card-title">{title}</h3>
          </div>
          <button className="modal-close-btn" onClick={onCancel} aria-label="Cerrar confirmación" title="Cerrar">✕</button>
        </div>
        <div className="modal-body">
          <p id={messageId}>{message}</p>
          {warning && (
            <div className="jf-confirm-warning">
              <AlertTriangle size={16} />
              <span>{warning}</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
