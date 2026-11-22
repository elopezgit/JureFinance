// RegistrarPagoLiquidacionModal.jsx - Modal reutilizable para registrar el pago
// consolidado de una liquidación (bloque de un proveedor). Lo usan el Calendario
// de Pagos y la Ficha del Viaje para que el reparto FIFO sea idéntico en ambos.
import React, { useState } from 'react';
import { Building2, CheckCircle2 } from 'lucide-react';
import {
  formatearMonto,
  formatFechaLarga,
  hoyISO,
  repartirPagoEnLiquidacion
} from '../../services/calendarioService';

const MEDIOS_PAGO = ['Transferencia', 'Efectivo', 'Tarjeta', 'Cheque', 'Otro'];

export default function RegistrarPagoLiquidacionModal({ liquidacion, onClose, onRegistrarLote }) {
  const saldoTotal = Math.max(liquidacion.saldo, 0);
  const [monto, setMonto] = useState(String(saldoTotal.toFixed(2)));
  const [fecha, setFecha] = useState(hoyISO());
  const [medio, setMedio] = useState('Transferencia');
  const [nota, setNota] = useState('');

  const montoNum = Math.min(Number(monto) || 0, saldoTotal);
  const puedeGuardar = montoNum > 0;
  const afectadas = liquidacion.items.filter((p) => Math.max(p.saldo, 0) > 0.005);
  const saldoRestante = Math.max(saldoTotal - montoNum, 0);

  const guardar = () => {
    if (!puedeGuardar) return;
    const registros = repartirPagoEnLiquidacion(liquidacion, montoNum, { fecha, medio, nota });
    if (registros.length && onRegistrarLote) onRegistrarLote(registros);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '640px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="card-title-group">
            <div className="card-icon">
              <Building2 size={18} />
            </div>
            <div>
              <h3 className="card-title">Pago consolidado · {liquidacion.proveedor}</h3>
              <p className="card-subtitle">
                {liquidacion.fechaVencimiento
                  ? `Vence ${formatFechaLarga(liquidacion.fechaVencimiento)}`
                  : 'Sin fecha de vencimiento'}
                {' · '}
                {liquidacion.cantidad} {liquidacion.cantidad === 1 ? 'obligación' : 'obligaciones'}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Cerrar">×</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="panel-inset" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div>
              <div className="metric-label" style={{ marginBottom: '4px' }}>Total del bloque</div>
              <strong className="mono">{formatearMonto(liquidacion.montoTotal, liquidacion.moneda)}</strong>
            </div>
            <div>
              <div className="metric-label" style={{ marginBottom: '4px' }}>Pagado</div>
              <strong className="mono" style={{ color: 'var(--success)' }}>
                {formatearMonto(liquidacion.pagado, liquidacion.moneda)}
              </strong>
            </div>
            <div>
              <div className="metric-label" style={{ marginBottom: '4px' }}>Saldo</div>
              <strong className="mono" style={{ color: saldoTotal > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {formatearMonto(saldoTotal, liquidacion.moneda)}
              </strong>
            </div>
          </div>

          <div style={{ maxHeight: '170px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {liquidacion.items.map((p) => (
              <div
                key={p.clave}
                className="row-soft"
                style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}
              >
                <div style={{ fontSize: '0.8rem', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.concepto}
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {p.cliente}{p.cotizacionId ? ` · ${p.cotizacionId}` : ''}
                  </div>
                  {Array.isArray(p.pasajeros) && p.pasajeros.length > 0 && (
                    <div
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.72rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={p.pasajeros.join(', ')}
                    >
                      {p.pasajeros.join(', ')}
                    </div>
                  )}
                </div>
                <div className="mono" style={{ textAlign: 'right', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                  <div>{formatearMonto(p.montoTotal, p.moneda)}</div>
                  {Math.max(p.saldo, 0) > 0.005 && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.74rem' }}>
                      saldo {formatearMonto(Math.max(p.saldo, 0), p.moneda)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">Monto del pago</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={saldoTotal}
                className="input-field mono"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Podés pagar todo el bloque o un abono parcial.
              </span>
            </div>
            <div>
              <label className="form-label">Fecha</label>
              <input
                type="date"
                className="input-field"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">Medio</label>
              <select className="select-field" value={medio} onChange={(e) => setMedio(e.target.value)}>
                {MEDIOS_PAGO.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Nota (opcional)</label>
              <input
                className="input-field"
                placeholder="N° de comprobante, observaciones…"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
            </div>
          </div>

          <div className="row-soft" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Se repartirá entre <strong>{afectadas.length}</strong> obligación(es), de la más antigua a la más nueva.
            </span>
            <strong className="mono" style={{ color: saldoRestante > 0 ? 'var(--warning)' : 'var(--success)' }}>
              Saldo tras el pago: {formatearMonto(saldoRestante, liquidacion.moneda)}
            </strong>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={!puedeGuardar}>
            <CheckCircle2 size={16} />
            <span>Registrar pago del bloque</span>
          </button>
        </div>
      </div>
    </div>
  );
}
