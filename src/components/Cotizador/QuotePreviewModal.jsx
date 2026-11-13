// QuotePreviewModal.jsx - Resumen interno de números de la cotización.
//
// El presupuesto que recibe el cliente se arma fuera de la app con el constructor
// de PDF del proveedor (ej. Azabache). Este documento es de uso interno de JureTravel:
// muestra los costos guardados por separado de cada proveedor (Aero vs Azabache),
// las fechas de pago (24-48 hs post-emisión vs Grilla 1-5 -> día 20), el precio final
// al cliente y la ganancia real.
import React from 'react';
import {
  X,
  Printer,
  Plane,
  Hotel,
  ShieldCheck,
  Car,
  Calendar,
  Users,
  MapPin,
  Sparkles,
  TrendingUp,
  Lock
} from 'lucide-react';
import {
  normalizarServicios,
  SECCION_LABEL,
  precioVentaItem,
  costoCompraItem,
  costoBasePresupuestoItem,
  gananciaItem,
  ofertaCompraDe,
  ofertaBasePresupuestoDe,
  desgloseCostosPorProveedor,
  totalVentaItems,
  totalCostoItems,
  totalCostoBasePresupuestoItems,
  totalGananciaItems,
  margenVentaItems
} from '../../services/serviciosService';
import { getBloqueBCP, getFechaPagoAereoEmitido } from '../../services/ttoService';
import { formatFechaLarga } from '../../services/calendarioService';

const ESTILO_POR_TIPO = {
  aereo: { Icono: Plane, fondo: '#dbeafe', color: '#1d4ed8' },
  hotel: { Icono: Hotel, fondo: '#fef3c7', color: '#b45309' },
  traslados: { Icono: Car, fondo: '#e0e7ff', color: '#4338ca' },
  asistencia: { Icono: ShieldCheck, fondo: '#d1fae5', color: '#065f46' },
  extra: { Icono: Sparkles, fondo: '#fce7f3', color: '#9d174d' }
};

const formato = (moneda, valor) =>
  `${moneda || 'USD'} $${Number(valor || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

export default function QuotePreviewModal({ quote, configMensual = [], onClose }) {
  if (!quote) return null;

  const { destino, fechaViajeInicio, fechaViajeFin, fechaCotizacion, pax, pasajeros, moneda, notas } = quote;
  const cliente = quote.cliente;
  const paxCount = Math.max(1, Number(pax) || 1);

  const items = normalizarServicios(quote.servicios, { pax }).filter((item) => item.activo);
  const totalVenta = totalVentaItems(items);
  const totalCosto = totalCostoItems(items);
  const totalCostoBase = totalCostoBasePresupuestoItems(items);
  const ganancia = totalGananciaItems(items);
  const margen = margenVentaItems(items);
  const desgloseProveedores = desgloseCostosPorProveedor(items);

  const handlePrint = () => {
    window.print();
  };

  const obtenerVencimientoTexto = (item) => {
    const compra = ofertaCompraDe(item);
    if (!compra) return 'Sin proveedor';
    if (compra.vencimientoTTOO) return `Pago ${formatFechaLarga(compra.vencimientoTTOO)} (manual)`;
    if (item.tipo === 'aereo') {
      if (!item.fechaEmision) return 'Pago a 24-48 hs post-emisión confirmada';
      if (item.reglaVencimiento !== 'bcp') {
        const horas = Number(item.plazoPagoHoras) === 24 ? 24 : 48;
        return `Pago ${horas} hs post-emisión: ${formatFechaLarga(getFechaPagoAereoEmitido(item.fechaEmision, horas))}`;
      }
      const b = getBloqueBCP(configMensual, compra.proveedor || 'Aero', item.fechaEmision);
      return b ? `Bloque ${b.rangoCorto} → Pago ${formatFechaLarga(b.fechaPago)}` : 'Sin bloque';
    }
    const fRef = item.fechaReserva || fechaCotizacion || '';
    if (!fRef) return 'Según grilla mensual (1-5 → día 20)';
    const b = getBloqueBCP(configMensual, compra.proveedor || 'Azabache', fRef);
    return b ? `Reservado Bloque ${b.rangoCorto} → Pago ${formatFechaLarga(b.fechaPago)}` : 'Según grilla mensual';
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '940px', background: '#ffffff', color: '#111827' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior del modal (oculta al imprimir) */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}
            >
              <Lock size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', margin: 0 }}>
                Resumen interno de números (JureTravel)
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Documento interno: desglose de Proveedor 1 (Aero), Proveedor 2 (Azabache) y Cliente Final
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
              <Printer size={15} />
              <span>Imprimir / Guardar PDF</span>
            </button>
            <button onClick={onClose} className="modal-close-btn">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Documento imprimible */}
        <div className="modal-body printable-quote" style={{ padding: '36px 44px', background: '#ffffff' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '2px solid #e5e7eb',
              paddingBottom: '24px',
              marginBottom: '28px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: '1.6rem',
                    fontWeight: 800,
                    color: '#1e3a8a',
                    letterSpacing: '-0.02em'
                  }}
                >
                  JureFinance
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#b45309',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: '#fef3c7'
                  }}
                >
                  Uso interno JureTravel
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: 0 }}>
                Costos separados por Proveedor (Aero / Azabache), Calendario de Pagos y Precio Final al Cliente
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>
                Ref: {quote.id || 'COT-NUEVA'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                Fecha: <strong>{fechaCotizacion || new Date().toISOString().split('T')[0]}</strong>
              </div>
            </div>
          </div>

          {/* Cliente y viaje */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px 24px',
              marginBottom: '24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
                Cliente
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '3px' }}>
                {cliente || 'Nombre del Cliente'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
                Destino
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} color="#3b82f6" />
                {destino || 'Destino a convenir'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
                Fechas
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={16} color="#3b82f6" />
                {fechaViajeInicio || '—'} al {fechaViajeFin || '—'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
                Pasajeros
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} color="#3b82f6" />
                {paxCount}
              </div>
              {Array.isArray(pasajeros) && pasajeros.length > 0 && (
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '3px' }}>
                  {pasajeros.join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Resumen por proveedor */}
          {desgloseProveedores.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              {desgloseProveedores.map((p) => (
                <div
                  key={p.proveedorId}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#1e3a8a' }}>
                    Proveedor: {p.proveedor}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px' }}>
                    Cotizado en {p.proveedor}: <strong>{formato(moneda, p.totalCotizadoReferencia)}</strong>
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#0f172a', marginTop: '2px', fontWeight: 800 }}>
                    A pagar realmente: {formato(moneda, p.totalAPagarCompra)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Detalle por servicio */}
          <div style={{ marginBottom: '28px' }}>
            <h4
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#0f172a',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '8px',
                marginBottom: '14px'
              }}
            >
              Detalle por servicio (Costos por Proveedor, Vencimientos y Precio al Cliente)
            </h4>

            {items.length === 0 && (
              <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
                No hay servicios activos en esta cotización.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {items.map((item) => {
                const estilo = ESTILO_POR_TIPO[item.tipo] || ESTILO_POR_TIPO.extra;
                const { Icono } = estilo;
                const compra = ofertaCompraDe(item);
                const basePDF = ofertaBasePresupuestoDe(item);
                const venta = precioVentaItem(item);
                const costo = costoCompraItem(item);
                const costoBase = costoBasePresupuestoItem(item);
                const utilidad = gananciaItem(item);

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: estilo.fondo,
                        color: estilo.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Icono size={17} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                        {item.nombre || SECCION_LABEL[item.tipo] || 'Servicio'}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                        {SECCION_LABEL[item.tipo] || item.tipo} · Se compra a{' '}
                        <strong>{compra?.proveedor || 'sin proveedor'}</strong> ·{' '}
                        {obtenerVencimientoTexto(item)}
                      </div>
                      {(item.ofertas || []).length > 1 && (
                        <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px' }}>
                          Valores por proveedor:{' '}
                          {(item.ofertas || [])
                            .map(
                              (o) =>
                                `${o.proveedor}: ${formato(moneda, o.costo)}${
                                  o.id === compra?.id ? ' (Compra)' : ''
                                }${o.id === basePDF?.id ? ' (Base PDF)' : ''}`
                            )
                            .join(' | ')}
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '92px' }}>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>Base PDF</div>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#b45309' }}>
                        {formato(moneda, costoBase)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '92px' }}>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>Costo real</div>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formato(moneda, costo)}</div>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '92px' }}>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>Cliente</div>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formato(moneda, venta)}</div>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '92px' }}>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>Ganancia</div>
                      <div
                        style={{
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          color: utilidad >= 0 ? '#047857' : '#b91c1c'
                        }}
                      >
                        {formato(moneda, utilidad)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totales */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
              color: '#ffffff',
              borderRadius: '16px',
              padding: '22px 26px',
              marginBottom: '22px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '18px',
              boxShadow: '0 10px 25px -5px rgba(30, 58, 138, 0.4)'
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85, fontWeight: 700 }}>
                Base PDF (Azabache)
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#fde68a' }}>
                {formato(moneda, totalCostoBase)}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                {formato(moneda, totalCostoBase / paxCount)} por pax
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85, fontWeight: 700 }}>
                Costo real compra
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                {formato(moneda, totalCosto)}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                {formato(moneda, totalCosto / paxCount)} por pax
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85, fontWeight: 700 }}>
                Precio al cliente
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                {formato(moneda, totalVenta)}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                {formato(moneda, totalVenta / paxCount)} por pax
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <TrendingUp size={13} /> Ganancia real
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: ganancia >= 0 ? '#6ee7b7' : '#fca5a5' }}>
                {formato(moneda, ganancia)}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                Margen sobre venta: {margen.toFixed(1)}%
              </div>
            </div>
          </div>

          {notas && (
            <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '8px', borderLeft: '4px solid #3b82f6', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                Notas internas
              </div>
              <p style={{ fontSize: '0.82rem', color: '#334155', margin: 0, whiteSpace: 'pre-line' }}>
                {notas}
              </p>
            </div>
          )}

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', fontSize: '0.72rem', color: '#64748b' }}>
            <p style={{ margin: 0 }}>
              Documento de uso interno. El presupuesto que recibe el cliente se genera con el
              constructor de PDF del proveedor (Azabache). Los importes son totales del viaje, expresados en{' '}
              {moneda || 'USD'}.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cerrar resumen
          </button>
          <button className="btn btn-primary btn-sm" onClick={handlePrint}>
            <Printer size={15} />
            <span>Imprimir / Exportar a PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
