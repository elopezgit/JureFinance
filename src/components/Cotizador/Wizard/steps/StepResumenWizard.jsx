// StepResumenWizard.jsx - Paso 3: resumen y precio de venta.
// Los importes vienen del wizard (fuente de verdad), así que lo que se muestra
// es exactamente lo que se guarda en la cotización.
import React, { useId, useState } from 'react';
import { FileText, Save, Eye, TrendingUp } from 'lucide-react';
import { costoCompraItem, formatoMoneda, formatoPct } from '../wizardUtils';

export default function StepResumenWizard({
  cliente,
  destino,
  moneda,
  items = [],
  totalCosto,
  gananciaRealTotal,
  margenRealPct,
  onSave,
  onPreview,
  saveSuccessMessage,
  markupGlobalPct = 20,
  setMarkupGlobalPct,
  precioVentaPaquete = 0,
  setPrecioVentaPaquete,
  totalNeto = 0,
  totalVenta = 0
}) {
  const uid = useId();
  const [modoVenta, setModoVenta] = useState(
    Number(precioVentaPaquete) > 0 ? 'manual' : 'porcentaje'
  );
  const activos = (items || []).filter((i) => i.activo);

  const neto = Number(totalNeto || totalCosto || 0);
  const venta = Number(totalVenta || 0);
  const ganancia = Number.isFinite(Number(gananciaRealTotal))
    ? Number(gananciaRealTotal)
    : venta - neto;
  const margen = Number.isFinite(Number(margenRealPct))
    ? Number(margenRealPct)
    : venta > 0
      ? (ganancia / venta) * 100
      : 0;
  const ventaSugerida = neto * (1 + (Number(markupGlobalPct) || 0) / 100);

  const cambiarMarkup = (valor) => {
    const pct = Number(String(valor).replace(',', '.')) || 0;
    setMarkupGlobalPct?.(pct);
    if (modoVenta === 'porcentaje') {
      // El precio final se deriva del costo real + markup y se guarda como
      // precio de venta del paquete para que resumen y persistencia coincidan.
      setPrecioVentaPaquete?.(Number((neto * (1 + pct / 100)).toFixed(2)));
    }
  };

  const cambiarModo = (modo) => {
    setModoVenta(modo);
    if (modo === 'manual' && !(Number(precioVentaPaquete) > 0)) {
      setPrecioVentaPaquete?.(Number(ventaSugerida.toFixed(2)));
    } else if (modo === 'porcentaje') {
      setPrecioVentaPaquete?.(Number((neto * (1 + (Number(markupGlobalPct) || 0) / 100)).toFixed(2)));
    }
  };

  const labelIdMarkup = `${uid}-markup`;
  const labelIdPrecio = `${uid}-precio`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card glass-card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon"><FileText size={18} /></div>
            <div>
              <h3 className="card-title">Resumen de la cotización</h3>
              <span className="card-subtitle">{cliente || 'Sin cliente'} - {destino || 'Sin destino'}</span>
            </div>
          </div>
        </div>

        <div className="jf-table-wrap" style={{ marginBottom: '14px' }}>
          <table className="jf-table">
            <caption className="sr-only">Detalle de servicios y costo neto de la cotización</caption>
            <thead>
              <tr>
                <th scope="col">Servicio</th>
                <th scope="col" style={{ textAlign: 'right' }}>Costo neto</th>
              </tr>
            </thead>
            <tbody>
              {activos.length === 0 ? (
                <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Sin servicios activos</td></tr>
              ) : (
                activos.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nombre || 'Servicio'}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{formatoMoneda(moneda, costoCompraItem(item))}</td>
                  </tr>
                ))
              )}
              <tr>
                <td style={{ fontWeight: 700 }}>Total neto</td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{formatoMoneda(moneda, neto)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card glass-card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={modoVenta === 'porcentaje' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              aria-pressed={modoVenta === 'porcentaje'}
              onClick={() => cambiarModo('porcentaje')}
            >
              Por % de aumento
            </button>
            <button
              type="button"
              className={modoVenta === 'manual' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              aria-pressed={modoVenta === 'manual'}
              onClick={() => cambiarModo('manual')}
            >
              Precio manual
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end' }}>
            <div>
              <label htmlFor={labelIdMarkup} className="form-label" style={{ fontSize: '0.74rem' }}>% de aumento global</label>
              <input
                id={labelIdMarkup}
                type="number"
                step="0.1"
                min="0"
                className="input-field"
                style={{ height: '36px' }}
                value={Number(markupGlobalPct) || 0}
                onChange={(e) => cambiarMarkup(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor={labelIdPrecio} className="form-label" style={{ fontSize: '0.74rem' }}>Precio de venta ({moneda})</label>
              <div className="input-wrapper">
                <span className="input-prefix">$</span>
                <input
                  id={labelIdPrecio}
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-field input-with-prefix"
                  style={{ height: '36px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}
                  value={venta || ''}
                  onChange={(e) => {
                    setModoVenta('manual');
                    setPrecioVentaPaquete?.(Number(String(e.target.value).replace(',', '.')) || 0);
                  }}
                />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                <TrendingUp size={14} /> Ganancia neta
              </div>
              <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--neon-emerald)' }}>
                {formatoMoneda(moneda, ganancia)}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Margen {formatoPct(margen)}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
          <button className="btn btn-primary btn-lg" onClick={onSave} style={{ width: '100%' }}>
            <Save size={18} />
            <span>{saveSuccessMessage ? '¡Guardada con éxito!' : 'Guardar cotización'}</span>
          </button>
          <button className="btn btn-outline" onClick={onPreview} style={{ width: '100%', height: '42px' }}>
            <Eye size={16} />
            <span>Ver resumen interno</span>
          </button>
        </div>
      </div>
    </div>
  );
}
