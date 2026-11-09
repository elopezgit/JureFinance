// CalendarioCobrosView.jsx - Cuentas a cobrar a clientes (versión básica).
//
// Deriva los cobros del precio de venta de cada cotización y los agrupa por mes
// según la fecha de inicio del viaje. Todavía no registra cobros: muestra cuánto
// hay por cobrar y el estado de cada cotización.
// Próxima fase: señas, cuotas y arreglos de cobro (arreglosCobro).

import React, { useMemo } from 'react';
import { HandCoins, Info, Users, ArrowDownCircle, TrendingUp } from 'lucide-react';
import {
  derivarCobrosDesdeCotizaciones,
  resumenCobros,
  cobrosPorMes,
  etiquetaEstadoCobro
} from '../../services/cobroService';
import { formatearMonto, formatFechaLarga } from '../../services/calendarioService';
import { formatMesLabel } from '../../services/ttoService';

export default function CalendarioCobrosView({ cotizaciones = [], onIrACotizador }) {
  const cobros = useMemo(() => derivarCobrosDesdeCotizaciones(cotizaciones), [cotizaciones]);
  const resumen = useMemo(() => resumenCobros(cobros), [cobros]);
  const meses = useMemo(() => cobrosPorMes(cobros), [cobros]);
  const moneda = cobros[0]?.moneda || 'USD';

  return (
    <div>
      {/* Encabezado */}
      <div className="view-header" style={{ marginBottom: '18px' }}>
        <div className="section-heading">
          <HandCoins size={16} />
          Cuentas a cobrar a clientes
        </div>
        {onIrACotizador && (
          <button className="btn btn-secondary btn-sm" onClick={onIrACotizador}>
            <span>Ir al cotizador</span>
          </button>
        )}
      </div>

      {/* Métricas */}
      <div className="metrics-strip">
        <div className="metric-card highlight-profit">
          <div className="metric-label">
            A cobrar (cartera) <ArrowDownCircle size={15} />
          </div>
          <div className="metric-value">{formatearMonto(resumen.aCobrar, moneda)}</div>
          <div className="metric-sub">
            {resumen.cantidadPendientes} {resumen.cantidadPendientes === 1 ? 'cotización pendiente' : 'cotizaciones pendientes'}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Cobrado</div>
          <div className="metric-value" style={{ color: 'var(--success)' }}>
            {formatearMonto(resumen.cobrado, moneda)}
          </div>
          <div className="metric-sub">
            {resumen.cantidadCobradas} {resumen.cantidadCobradas === 1 ? 'cotización cobrada' : 'cotizaciones cobradas'}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">
            <TrendingUp size={15} /> Total de ventas
          </div>
          <div className="metric-value">{formatearMonto(resumen.totalCartera, moneda)}</div>
          <div className="metric-sub">Suma del precio de venta</div>
        </div>
      </div>

      {/* Ayuda */}
      <div className="panel-inset" style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
        <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          Los cobros se derivan <strong>automáticamente</strong> del precio de venta de cada
          cotización y se agrupan por mes según el <strong>inicio del viaje</strong>. Una
          cotización en estado <strong>Pagada</strong> figura como cobrada; el resto, como saldo
          a cobrar. Próxima fase: señas, cuotas y arreglos de cobro.
        </p>
      </div>

      {cobros.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <HandCoins size={24} />
            </div>
            <h3>Sin cobros por ahora</h3>
            <p>
              Cargá una cotización con precio de venta para empezar a ver tus cuentas a
              cobrar a clientes.
            </p>
          </div>
        </div>
      ) : (
        meses.map((grupo) => (
          <div className="card" key={grupo.mes} style={{ marginBottom: '16px' }}>
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-icon">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="card-title">
                    {grupo.mes === 'sin-fecha' ? 'Sin fecha' : formatMesLabel(grupo.mes)}
                  </h3>
                  <p className="card-subtitle">
                    {grupo.cantidad} {grupo.cantidad === 1 ? 'cotización' : 'cotizaciones'} · a
                    cobrar {formatearMonto(grupo.saldo, moneda)}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '20px', textAlign: 'right' }}>
                <div>
                  <div className="metric-label">Total</div>
                  <strong className="mono">{formatearMonto(grupo.total, moneda)}</strong>
                </div>
                <div>
                  <div className="metric-label">Cobrado</div>
                  <strong className="mono" style={{ color: 'var(--success)' }}>
                    {formatearMonto(grupo.cobrado, moneda)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="jf-table-wrap">
              <table className="jf-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Viaje</th>
                    <th>Inicio del viaje</th>
                    <th style={{ textAlign: 'right' }}>Pax</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Saldo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.items.map((c) => {
                    const etiqueta = etiquetaEstadoCobro(c);
                    return (
                      <tr key={c.clave}>
                        <td>
                          <strong>{c.cliente}</strong>
                          <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {c.cotizacionId}
                          </div>
                        </td>
                        <td style={{ maxWidth: '240px' }}>{c.concepto}</td>
                        <td>
                          {c.fechaReferencia ? (
                            formatFechaLarga(c.fechaReferencia)
                          ) : (
                            <span className="badge badge-neutral">Sin fecha</span>
                          )}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>{c.pax}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {formatearMonto(c.montoTotal, c.moneda)}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                          {formatearMonto(Math.max(c.saldo, 0), c.moneda)}
                        </td>
                        <td>
                          <span className={`badge ${etiqueta.badge}`}>{etiqueta.texto}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
