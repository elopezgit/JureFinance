// StepResumenWizard.jsx - Último paso: números finales separados por proveedor y guardado.
//
// Muestra, por cada servicio:
//   - Costo real de compra (ej. Aero en vuelos / Azabache en hotel y traslado)
//   - Costo referencia en el Constructor PDF (ej. Azabache)
//   - Precio final al cliente y ganancia neta
//   - Fecha y regla de pago al proveedor (24-48 hs post-emisión vs Grilla mensual 1-5 -> día 20)
import React from 'react';
import {
  FileText,
  Save,
  Eye,
  Plane,
  Hotel,
  Car,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  AlertTriangle,
  TrendingUp,
  CalendarClock,
  Building2
} from 'lucide-react';
import {
  SECCION_LABEL,
  costoCompraItem,
  costoBasePresupuestoItem,
  ahorroArbitrajeItem,
  precioVentaItem,
  gananciaItem,
  ofertaCompraDe,
  ofertaBasePresupuestoDe,
  desgloseCostosPorProveedor,
  totalCostoBasePresupuestoItems,
  totalAhorroArbitrajeItems,
  formatoMoneda,
  formatoPct
} from '../wizardUtils';
import { getBloqueBCP, getFechaPagoAereoEmitido } from '../../../../services/ttoService';
import { formatFechaLarga } from '../../../../services/calendarioService';

const TIPOS_ORDEN = ['aereo', 'hotel', 'traslados', 'asistencia', 'extra'];

const ICONO_POR_TIPO = {
  aereo: Plane,
  hotel: Hotel,
  traslados: Car,
  asistencia: ShieldCheck,
  extra: Sparkles
};

export default function StepResumenWizard({
  cliente,
  destino,
  fechaViajeInicio,
  fechaViajeFin,
  fechaCotizacion,
  configMensual = [],
  pax,
  moneda,
  items = [],
  totalVenta,
  totalCosto,
  gananciaRealTotal,
  margenRealPct,
  onToggleItem,
  onQuitarItem,
  onSave,
  onPreview,
  saveSuccessMessage
}) {
  const paxCount = Math.max(1, Number(pax) || 1);
  const activos = items.filter((item) => item.activo);
  const inactivos = items.filter((item) => !item.activo);

  const totalCostoBasePDF = totalCostoBasePresupuestoItems(items);
  const totalAhorroAero = totalAhorroArbitrajeItems(items);
  const desgloseProveedores = desgloseCostosPorProveedor(items);

  const serviciosVentaCero = activos.filter(
    (item) => costoCompraItem(item) > 0 && precioVentaItem(item) <= 0
  );

  const grupos = TIPOS_ORDEN.map((tipo) => ({
    tipo,
    servicios: items.filter((item) => item.tipo === tipo)
  })).filter((grupo) => grupo.servicios.length > 0);

  const obtenerResumenVencimiento = (item) => {
    const compra = ofertaCompraDe(item);
    if (!compra) return 'Sin proveedor';
    if (compra.vencimientoTTOO) {
      return `Vence ${formatFechaLarga(compra.vencimientoTTOO)} (manual)`;
    }
    if (item.tipo === 'aereo') {
      if (!item.fechaEmision) {
        return 'Vuelo: paga a 24-48 hs al confirmar emisión';
      }
      if (item.reglaVencimiento !== 'bcp') {
        const horas = Number(item.plazoPagoHoras) === 24 ? 24 : 48;
        const f = getFechaPagoAereoEmitido(item.fechaEmision, horas);
        return `⚡ Pago en ${horas} hs post-emisión: ${formatFechaLarga(f)}`;
      }
      const b = getBloqueBCP(configMensual, compra.proveedor || 'Aero', item.fechaEmision);
      return b ? `📅 Bloque ${b.rangoCorto} → Pago ${formatFechaLarga(b.fechaPago)}` : 'Sin bloque configurado';
    }
    if (item.estadoReserva === 'SinReservar') {
      return 'Sin reservar aún';
    }
    const fechaRef = item.fechaReserva || fechaCotizacion || '';
    if (!fechaRef) return 'Sin fecha de reserva';
    const b = getBloqueBCP(configMensual, compra.proveedor || 'Azabache', fechaRef);
    return b
      ? `📅 Reservado Bloque ${b.rangoCorto} → Pago ${formatFechaLarga(b.fechaPago)}`
      : 'Sin bloque en grilla mensual';
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
      {/* RESUMEN DETALLADO */}
      <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-icon">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="card-title">Resumen Completo: Proveedores, Pagos y Cliente</h3>
                <span className="card-subtitle">
                  Valores guardados por separado: Proveedor 1 (Aero), Proveedor 2 (Azabache PDF + Reservas) y Precio al Cliente.
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CLIENTE</div>
              <div style={{ fontWeight: 600 }}>{cliente || '-'}</div>
            </div>
            <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>DESTINO</div>
              <div style={{ fontWeight: 600 }}>{destino || '-'}</div>
            </div>
            <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>FECHAS</div>
              <div style={{ fontWeight: 600 }}>
                {fechaViajeInicio || '—'} a {fechaViajeFin || '—'}
              </div>
            </div>
            <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>PASAJEROS</div>
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={14} />
                {paxCount} PAX
              </div>
            </div>
          </div>

          {/* Tarjetas de separación por Proveedor */}
          {desgloseProveedores.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              {desgloseProveedores.map((prov) => (
                <div
                  key={prov.proveedorId}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(139, 92, 246, 0.28)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', textTransform: 'uppercase', color: 'var(--neon-cyan)', fontWeight: 700 }}>
                    <Building2 size={13} />
                    <span>{prov.proveedor}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    Cotizado en {prov.proveedor}:{' '}
                    <strong className="mono" style={{ color: '#fff' }}>
                      {formatoMoneda(moneda, prov.totalCotizadoReferencia)}
                    </strong>
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--neon-cyan)', marginTop: '3px' }}>
                    A pagar realmente:{' '}
                    <strong className="mono">{formatoMoneda(moneda, prov.totalAPagarCompra)}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}

          {serviciosVentaCero.length > 0 && (
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start'
              }}
            >
              <AlertTriangle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>
                Hay servicios con costo de compra pero sin precio de venta:{' '}
                {serviciosVentaCero.map((item) => item.nombre || SECCION_LABEL[item.tipo]).join(', ')}.
                Revisalos antes de guardar.
              </p>
            </div>
          )}

          {activos.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No hay servicios activos. Volvé al paso anterior para agregar servicios a la
              cotización.
            </div>
          )}

          {grupos.map(({ tipo, servicios }) => {
            const Icono = ICONO_POR_TIPO[tipo] || Sparkles;

            return (
              <div key={tipo} style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Icono size={16} color="var(--primary)" />
                  <span style={{ fontWeight: 700 }}>{SECCION_LABEL[tipo] || tipo}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {servicios.filter((item) => item.activo).length} de {servicios.length} en el
                    presupuesto
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {servicios.map((item) => {
                    const compra = ofertaCompraDe(item);
                    const basePDF = ofertaBasePresupuestoDe(item);
                    const venta = precioVentaItem(item);
                    const costo = costoCompraItem(item);
                    const costoBase = costoBasePresupuestoItem(item);
                    const ahorro = ahorroArbitrajeItem(item);
                    const ganancia = gananciaItem(item);
                    const ofertas = item.ofertas || [];
                    const resumenVenc = obtenerResumenVencimiento(item);

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md)',
                          background: item.activo ? 'var(--bg-surface)' : 'var(--bg-subtle)',
                          border: `1px solid ${item.activo ? 'var(--primary-border)' : 'var(--border)'}`,
                          opacity: item.activo ? 1 : 0.65
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <input
                            type="checkbox"
                            checked={item.activo}
                            onChange={() => onToggleItem(item.id)}
                            style={{ width: '17px', height: '17px', cursor: 'pointer' }}
                          />

                          <div style={{ flex: 1, minWidth: '200px' }}>
                            <div style={{ fontWeight: 600 }}>
                              {item.nombre || SECCION_LABEL[tipo] || 'Servicio'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {compra
                                ? `Se paga a ${compra.proveedor || 'sin proveedor'}`
                                : 'Sin oferta de compra'}
                              {item.tipo === 'aereo' && item.estadoVuelo
                                ? ` · ${item.estadoVuelo === 'Emitido' ? 'Emitido (Confirmado)' : item.estadoVuelo}`
                                : item.estadoReserva
                                  ? ` · ${item.estadoReserva}`
                                  : ''}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--neon-cyan)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <CalendarClock size={12} />
                              <span>{resumenVenc}</span>
                            </div>
                            {ofertas.length > 1 && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                                Valores guardados:{' '}
                                {ofertas
                                  .map(
                                    (oferta) =>
                                      `${oferta.proveedor || '—'} ${formatoMoneda(moneda, oferta.costo)}${
                                        oferta.id === compra?.id ? ' (Compra Real)' : ''
                                      }${oferta.id === basePDF?.id ? ' (Base PDF Cliente)' : ''}`
                                  )
                                  .join(' · ')}
                                {ahorro > 0 ? ` · Ahorro Aero vs ${basePDF?.proveedor}: +${formatoMoneda(moneda, ahorro)}` : ''}
                              </div>
                            )}
                          </div>

                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Base PDF</div>
                            <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neon-amber)' }}>
                              {formatoMoneda(moneda, costoBase)}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Costo Real</div>
                            <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                              {formatoMoneda(moneda, costo)}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Precio Cliente</div>
                            <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                              {formatoMoneda(moneda, venta)}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: '90px' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Ganancia</div>
                            <div
                              style={{
                                fontWeight: 800,
                                fontFamily: 'var(--font-mono)',
                                color: ganancia >= 0 ? 'var(--success)' : 'var(--danger)'
                              }}
                            >
                              {formatoMoneda(moneda, ganancia)}
                            </div>
                          </div>

                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => onQuitarItem(item.id)}
                            title="Quitar del resumen"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {inactivos.length > 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              {inactivos.length} servicio{inactivos.length === 1 ? '' : 's'} destildado
              {inactivos.length === 1 ? '' : 's'} (no suma{inactivos.length === 1 ? '' : 'n'} al
              presupuesto).
            </p>
          )}
        </div>
      </div>

      {/* TOTALES */}
      <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          className="card"
          style={{
            position: 'sticky',
            top: '90px'
          }}
        >
          <div className="card-header" style={{ marginBottom: '14px' }}>
            <h3 className="card-title" style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>
              Totales & Márgenes
            </h3>
            <span className="badge badge-info">{paxCount} PAX</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                Precio Final al Cliente <span style={{ color: 'var(--text-muted)' }}>({activos.length})</span>
              </span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)', fontSize: '0.96rem' }}>
                {formatoMoneda(moneda, totalVenta)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--neon-amber)' }}>Costo Base PDF (Azabache)</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neon-amber)', fontSize: '0.94rem' }}>
                {formatoMoneda(moneda, totalCostoBasePDF)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>Costo Real Compra (A pagar)</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.96rem' }}>
                {formatoMoneda(moneda, totalCosto)}
              </span>
            </div>

            {totalAhorroAero > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.28)' }}>
                <span style={{ fontSize: '0.8rem', color: '#34d399' }}>Ahorro compra en Aero vs PDF</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#34d399' }}>
                  +{formatoMoneda(moneda, totalAhorroAero)}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Precio Cliente / pasajero</span>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--neon-cyan)' }}>
                {formatoMoneda(moneda, totalVenta / paxCount)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Costo Real / pasajero</span>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {formatoMoneda(moneda, totalCosto / paxCount)}
              </span>
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              background: gananciaRealTotal >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'var(--danger-bg)',
              border: `1px solid ${gananciaRealTotal >= 0 ? 'rgba(16, 185, 129, 0.35)' : 'var(--danger-border)'}`,
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: '6px', color: gananciaRealTotal >= 0 ? '#34d399' : 'var(--neon-pink)' }}>
                <TrendingUp size={15} /> Ganancia Real Neta
              </span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '1.15rem',
                  fontFamily: 'var(--font-mono)',
                  color: gananciaRealTotal >= 0 ? '#34d399' : 'var(--neon-pink)'
                }}
              >
                {formatoMoneda(moneda, gananciaRealTotal)}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Margen sobre venta: <strong style={{ color: 'var(--text-main)' }}>{formatoPct(margenRealPct)}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="btn btn-primary btn-lg" onClick={onSave} style={{ width: '100%' }}>
              <Save size={18} />
              <span>{saveSuccessMessage ? '¡Guardada con éxito!' : 'Guardar Cotización'}</span>
            </button>
            <button className="btn btn-outline" onClick={onPreview} style={{ width: '100%', height: '42px' }}>
              <Eye size={16} />
              <span>Ver resumen interno</span>
            </button>
          </div>

          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '14px 0 0', lineHeight: 1.4 }}>
            El presupuesto que recibe el cliente se genera con el constructor de PDF de Azabache. Este
            resumen guarda por separado los costos de Aero, Azabache y el precio final al cliente, impactando en tu Calendario de Pagos.
          </p>
        </div>
      </div>
    </div>
  );
}
